const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config');
const woocommerce = require('./woocommerce');
const messenger = require('./messenger');
const telegram = require('./telegram');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `
انت مساعد مبيعات ذكي تشتغل على صفحة ماسنجر لـ"${config.store.name}" — ${config.store.description}. خلي كل ردودك وأمثلتك واقتراحاتك مناسبة لهذا النوع من المحل تحديداً (مثلاً لو حد يسأل عن مقاسات أو ألوان، اسأل بطريقة تناسب نوع المنتجات اللي المحل يبيعها فعلاً).

أسلوبك:

- اتكلم بالدارجة الليبية الطبيعية بس، مو فصحى، ومو لهجة مصرية أو خليجية أو شامية. لازم يبين وضوح إنك ليبي من أول كلمتين.
- خليك مختصر ومباشر، ما تطولش في الردود، وما تستخدمش كلام رسمي زايد.
- لو الزبون كتب بلهجة ثانية أو فصحى، فاهمها عادي بس رد عليه بالليبي دايماً.
- لو ما فهمتش الصوت زين، قوله بلطف "ما سمعتش زينة، تقدر تكتبها؟"
- لو الزبون بعتلك صورة منتج يسأل عليه، شوفها زين وحدد شنو هي قبل ما تفتش في الكتالوج.

مفردات ليبية استخدمها بدل الفصحى أو اللهجات الثانية (أمثلة، مو قايمة نهائية — الفكرة إنك تفكر بالطريقة الليبية مو تترجم من الفصحى):
- "شنو" مو "ايه" أو "ماذا"
- "نبي" / "نبيك" مو "عايز" أو "أريد"
- "قداش" مو "كم سعر" أو "بكام"
- "وين" مو "فين"
- "كيفاش" / "علاش" مو "إزاي" أو "ليه"
- "زوين" / "حلو" للتعبير عن شي كويس
- "توا" مو "دلوقتي" أو "الآن"
- "هذا" / "هذي" / "هذاك"
- "ماشي" للموافقة، "تمام" أو "أوكي" برضو تستخدم عادي
- "عادي" ، "يعطيك العافية" ، "الله يعطيك الصحة" كتعابير طبيعية

مثال على أسلوب الرد الصح:
زبون: "عندكم قمصان بيضاء؟"
انت: "أيوا عندنا، شوية نشوفلك شنو متوفر توا... [بعد البحث] عندي قميص أبيض قطن بـ45 دينار، تحب نبعتلك صورة؟"

زبون: "قداش السعر؟"
انت: "45 دينار، وعندنا مقاسات S لحد XL، أي مقاس يناسبك؟"

تجنب تماماً عبارات زي "تمام كده"، "إزيك"، "عايز حاجة"، "يا فندم" (دي مصرية) أو "شلونك"، "أبغى" (دي خليجية) — هذي ما تنقالش في ليبيا.

مهمتك: تساعد الزبون يلقى المنتج اللي يبيه، تضيفه للطلبية، وتاخذ بياناته (الاسم، الرقم، العنوان) وتأكد الطلبية.

قواعد مهمة:
- استخدم search_products أي وقت الزبون يسأل عن منتج أو يوصف شي يبيه. لا تخترع أسماء منتجات أو أسعار من عندك.
- لما تسوي search_products، استخدم كلمة أساسية بسيطة (اسم المنتج بالمفرد، بدون صيغة الجمع) بدل الجملة كاملة — مثلاً "قميص" مو "قمصان بيضاء قطن".
- لو النتيجة رجعت فاضية أو ما فيها شي مناسب، جرب مرة ثانية بكلمة أبسط أو مرادف قبل ما تقول للزبون "ما عندنا". مثلاً لو "قمصان بيضاء" ما رجعت شي، جرب "قميص" لحاله.
- لو بعد أكثر من محاولة ما لقيت شي مناسب، هنا بس قول للزبون بصراحة إنه غير متوفر حالياً، واقترح عليه يشوف منتجات ثانية.
- لو في أكثر من نتيجة، اذكرهم للزبون باختصار وخليه يختار.
- استخدم send_product_photo لو الزبون طلب يشوف صورة، أو لو يقولك "ابعتلي صورة" أو شي مشابه.
- لما الزبون يأكد شي يبيه، استخدم add_item_to_cart.
- قبل ما تأكد الطلبية النهائية، لازم يكون عندك: اسم الزبون، رقم هاتفه، والعنوان. اسألهم لو ناقصين.
- لما كل شي كامل والزبون يأكد الطلبية، استخدم finalize_order مرة وحدة بس.
- بعد finalize_order، قول للزبون بأن الطلبية وصلت واشكره.

رد دايما بشكل طبيعي كإنسان، بدون أي علامات أو JSON في الرسالة النهائية للزبون.
`.trim();

const tools = [
  {
    name: 'search_products',
    description: 'Search the store catalog by keyword. Use whenever the customer mentions or describes a product. Use a short, singular base-form keyword (e.g. "قميص" not "قمصان بيضاء") for the best match — you can call this more than once with different wording if the first search comes back empty.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords, e.g. product name or description' },
      },
      required: ['query'],
    },
  },
  {
    name: 'send_product_photo',
    description: 'Send a product photo to the customer in the chat. Use when the customer asks to see a product, or it would help them decide.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', description: 'The product id from a previous search_products result' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'add_item_to_cart',
    description: 'Add a product the customer confirmed they want to their order.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'number' },
        name: { type: 'string' },
        price: { type: 'string' },
        quantity: { type: 'number', default: 1 },
        variant: { type: 'string', description: 'e.g. color/size, if applicable', default: '' },
      },
      required: ['product_id', 'name', 'price', 'quantity'],
    },
  },
  {
    name: 'update_customer_info',
    description: 'Save or update the customer\'s name, phone number, address, or delivery notes as they provide them.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'finalize_order',
    description: 'Call once, only when the cart is non-empty, customer info (name/phone/address) is complete, and the customer has confirmed they want to place the order. This notifies the store owner.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

async function executeTool(toolName, input, session, psid) {
  switch (toolName) {
    case 'search_products': {
      const results = await woocommerce.searchProducts(input.query);
      return results;
    }

    case 'send_product_photo': {
      const product = await woocommerce.getProduct(input.product_id);
      if (product?.image_url) {
        await messenger.sendImage(psid, product.image_url);
        return { sent: true };
      }
      return { sent: false, reason: 'no image available' };
    }

    case 'add_item_to_cart': {
      session.cart.push({
        product_id: input.product_id,
        name: input.name,
        price: input.price,
        quantity: input.quantity || 1,
        variant: input.variant || '',
      });
      return { cart: session.cart };
    }

    case 'update_customer_info': {
      session.customer = { ...session.customer, ...input };
      return { customer: session.customer };
    }

    case 'finalize_order': {
      if (session.cart.length === 0) {
        return { success: false, reason: 'cart is empty' };
      }
      const summary = buildOrderSummary(session);
      await telegram.sendOrderSummary(summary);
      return { success: true };
    }

    default:
      return { error: `unknown tool ${toolName}` };
  }
}

function buildOrderSummary(session) {
  const lines = [
    '🛒 طلبية جديدة',
    '',
    ...session.cart.map(
      (item) =>
        `• ${item.name}${item.variant ? ` (${item.variant})` : ''} × ${item.quantity} — ${item.price} د.ل`
    ),
    '',
    `الاسم: ${session.customer.name || '—'}`,
    `الهاتف: ${session.customer.phone || '—'}`,
    `العنوان: ${session.customer.address || '—'}`,
  ];
  if (session.customer.notes) lines.push(`ملاحظات: ${session.customer.notes}`);
  return lines.join('\n');
}

const DIALECT_REMINDER =
  '\n\n[تذكير داخلي — ما تردش عليه، بس اتبعه: جاوب بالدارجة الليبية بس، ' +
  'وتجنب أي كلمة مصرية أو خليجية أو فصحى رسمية.]';

async function handleMessage(session, userContent, psid) {
  const content =
    typeof userContent === 'string' ? userContent + DIALECT_REMINDER : userContent;

  session.history.push({ role: 'user', content });

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages: session.history,
  });

  while (response.stop_reason === 'tool_use') {
    session.history.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input, session, psid);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    session.history.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: session.history,
    });
  }

  const finalText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  session.history.push({ role: 'assistant', content: response.content });

  return finalText;
}

const IMAGE_MESSAGE_INSTRUCTION =
  'الزبون بعت صورة منتج يسأل عليه. شوف الصورة، حدد شنو المنتج (نوعه ولونه بإيجاز)، ' +
  'بعدين استخدم search_products عشان تشوف عندنا شي شبيه أو لا. لو لقيت شي قريب، ' +
  'قوله للزبون مع السعر، ولو ما لقيتش شي مناسب قوله بصراحة إنه غير متوفر.' +
  DIALECT_REMINDER;

async function handleImageMessage(session, mediaType, base64Data, psid) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: IMAGE_MESSAGE_INSTRUCTION },
  ];
  return handleMessage(session, content, psid);
}

module.exports = { handleMessage, handleImageMessage };
