const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config');
const inventory = require('./inventory');
const { getSession, saveSession, resetSession } = require('./session');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const MODEL = 'claude-sonnet-4-6';

// A single fixed session key — there's only ever one owner using this.
const OWNER_SESSION_KEY = '__owner_admin__';

const SYSTEM_PROMPT = `
انت مساعد إدارة المخزون الخاص بصاحب المحل، تشتغل معاه في الشات الخاص بيه على تيليجرام — هذا مو بوت الزبائن، هذا خاص بيه بس.

اتكلم بالدارجة الليبية، بشكل عملي ومباشر، بدون رموز ماركداون (**، #).

مهمتك: تساعده يدير المخزون — يضيف منتجات جديدة، يعدل الأسعار، يزيد أو ينقص كمية قطع معينة، يمسح منتجات أو متغيرات.

قواعد مهمة:
- استخدم list_products لو ما تعرفش الـ product_id بالضبط، أو لو الزبون (صاحب المحل) ذكر اسم منتج بس مو الـ ID.
- استخدم get_product_details لما تحتاج تشوف كل المتغيرات (المقاسات/الألوان) الحالية لمنتج معين.
- استخدم adjust_stock لما يقول "زيد X قطعة" أو "انقص X قطعة" أو "بيعت X قطعة" لمقاس/لون معين — الرقم يكون موجب للزيادة وسالب للنقصان.
- لو قال "خلص عندي X" أو أرقام مطلقة (مو زيادة/نقصان)، احسب الفرق بينها وبين الكمية الحالية (استخدم get_product_details الأول) وبعدين استخدم adjust_stock بالفرق.
- استخدم add_product لما يبي يضيف منتج كامل جديد.
- استخدم update_product_info لتعديل الاسم/السعر/الصورة/الوصف — بدون ما تلمس المتغيرات.
- استخدم delete_variant لمسح مقاس/لون معين بس.
- قبل ما تستخدم delete_product (مسح منتج كامل)، لازم تأكد معاه أول مرة ("متأكد تبي تمسح [اسم المنتج] بالكامل؟") وما تنفذش إلا لو أكدلك صراحة.
- بعد أي عملية، لخصله شنو صار بجملة وحدة أو جملتين، بدون تفاصيل تقنية.
- لو صاحب المحل طلب يضيف أكثر من منتج في نفس الرسالة (مثلاً "أضيفهم كلهم مع بعض")، ضيفهم واحد واحد لكن ما تحاولش ترد بملخص طويل عن كلهم في نفس الرسالة — أضف أول منتج، أكدله بجملة قصيرة، وانتظر يقول "كمل" أو يبعت البقية قبل ما تكمل، إلا لو كانت القايمة قصيرة (منتجين ثلاثة بس).

رد دايما كإنسان عادي، بدون JSON أو أكواد في ردك النهائي.
`.trim();

const tools = [
  {
    name: 'list_products',
    description: 'List all products with id, name, price, and total stock quantity. Use when you need to find a product\'s id from its name.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_product_details',
    description: 'Get full details of one product including every variant (size/color) and its current quantity.',
    input_schema: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
    },
  },
  {
    name: 'add_product',
    description: 'Add a brand new product to the catalog.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'English, no spaces, e.g. red-hoodie' },
        name: { type: 'string' },
        price: { type: 'string' },
        image_url: { type: 'string' },
        description: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, quantity: { type: 'number' } },
            required: ['label', 'quantity'],
          },
        },
      },
      required: ['id', 'name', 'price', 'variants'],
    },
  },
  {
    name: 'update_product_info',
    description: 'Update a product\'s name, price, image, description, and/or keywords — does not touch stock/variants.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'string' },
        image_url: { type: 'string' },
        description: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'adjust_stock',
    description: 'Increase or decrease the quantity of one specific variant (size/color) by a delta. Positive to add pieces, negative to remove. Creates the variant if it does not exist yet and delta is positive.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        variant_label: { type: 'string', description: 'Exact label, e.g. "أسود - M"' },
        delta: { type: 'number' },
      },
      required: ['product_id', 'variant_label', 'delta'],
    },
  },
  {
    name: 'delete_variant',
    description: 'Remove one specific size/color variant from a product entirely.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        variant_label: { type: 'string' },
      },
      required: ['product_id', 'variant_label'],
    },
  },
  {
    name: 'delete_product',
    description: 'Delete an entire product. Only call this after the owner has explicitly confirmed — never on the first request.',
    input_schema: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
    },
  },
];

async function executeTool(toolName, input) {
  switch (toolName) {
    case 'list_products':
      return inventory.listProducts();
    case 'get_product_details':
      return inventory.getProduct(input.product_id);
    case 'add_product':
      return inventory.addProduct({
        id: input.id,
        name: input.name,
        price: String(input.price),
        image_url: input.image_url || null,
        description: input.description || '',
        keywords: input.keywords || [],
        variants: input.variants,
      });
    case 'update_product_info': {
      const { product_id, ...fields } = input;
      if (fields.price) fields.price = String(fields.price);
      return inventory.updateProduct(product_id, fields);
    }
    case 'adjust_stock':
      return inventory.adjustStock(input.product_id, input.variant_label, input.delta);
    case 'delete_variant':
      return inventory.deleteVariant(input.product_id, input.variant_label);
    case 'delete_product':
      return inventory.deleteProduct(input.product_id);
    default:
      return { error: `unknown tool ${toolName}` };
  }
}

const RESET_COMMANDS = ['reset', 'ابدأ من جديد', 'أعد البداية', 'restart'];

async function handleAdminMessage(userText) {
  // Manual escape hatch — if the conversation ever gets stuck (e.g. a
  // response got cut off mid-tool-call), the owner can type this instead
  // of needing a Railway restart.
  if (RESET_COMMANDS.includes(userText.trim().toLowerCase())) {
    resetSession(OWNER_SESSION_KEY);
    return 'تم مسح الذاكرة، ابدأ من جديد.';
  }

  const session = getSession(OWNER_SESSION_KEY);
  session.history.push({ role: 'user', content: userText });

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages: session.history,
  });

  while (response.stop_reason === 'tool_use') {
    session.history.push({ role: 'assistant', content: response.content });

    // Every tool_use block MUST get a matching tool_result, even if the
    // tool throws — otherwise the conversation history becomes permanently
    // invalid and every future message fails, with no way to recover short
    // of clearing the whole conversation.
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        let result;
        try {
          result = await executeTool(block.name, block.input);
        } catch (err) {
          console.error(`Admin tool "${block.name}" failed:`, err);
          result = { success: false, reason: `internal error: ${err.message || 'unknown'}` };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    session.history.push({ role: 'user', content: toolResults });
    saveSession(OWNER_SESSION_KEY, session); // save progress after each resolved step

    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: session.history,
    });
  }

  // If the response got cut off (hit the token limit) rather than ending
  // cleanly, DON'T save it — a truncated response can contain a half-formed
  // tool_use block with no way to resolve it, which is exactly what
  // corrupted the conversation before. Better to drop this turn and ask the
  // owner to try again with a smaller request.
  if (response.stop_reason === 'max_tokens') {
    return 'الطلب كبير زايد، جرب تسويها على دفعات أصغر (مثلاً منتج أو منتجين في كل مرة).';
  }

  const finalText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  session.history.push({ role: 'assistant', content: response.content });
  saveSession(OWNER_SESSION_KEY, session);

  return finalText;
}

module.exports = { handleAdminMessage };
