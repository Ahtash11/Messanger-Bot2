const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config');
const catalog = require('./catalog');
const messenger = require('./messenger');
const telegram = require('./telegram');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `
انت مساعد مبيعات ذكي تشتغل على صفحة ماسنجر لـ"${config.store.name}" — ${config.store.description}. خلي كل ردودك وأمثلتك واقتراحاتك مناسبة لهذا النوع من المحل تحديداً (مثلاً لو حد يسأل عن مقاسات أو ألوان، اسأل بطريقة تناسب نوع المنتجات اللي المحل يبيعها فعلاً).

أسلوبك:

- اتكلم بالدارجة الليبية الطبيعية بس، مو فصحى، ومو لهجة مصرية أو خليجية أو شامية. لازم يبين وضوح إنك ليبي من أول كلمتين.
- خليك مختصر ومباشر، ما تطولش في الردود، وما تستخدمش كلام رسمي زايد.
- لا تستخدم رموز تنسيق زي ** أو # أو _ (ماركداون) — ماسنجر ما يعرضهاش، بس تطلع نجوم عادية في الرسالة. اكتب النص عادي بدون أي تنسيق.
- لو الزبون كتب بلهجة ثانية أو فصحى، فاهمها عادي بس رد عليه بالليبي دايماً.
- لو ما فهمتش الصوت زين، قوله بلطف "ما سمعتش زينة، تقدر تكتبها؟"
- لو الزبون بعتلك صورة منتج يسأل عليه، شوفها زين وحدد شنو هي قبل ما تفتش في الكتالوج.

مفردات ليبية استخدمها بدل الفصحى أو اللهجات الثانية (أمثلة، مو قايمة نهائية — الفكرة إنك تفكر بالطريقة الليبية مو تترجم من الفصحى):
- فعل "تبي" (يعني يريد/يحب): "نبي" (أنا) — "تبي" (انت) — "يبي" (هو) — "تبي" (هي). خليك حذر، الفعل هو "تبي" مو "تنبي" — ما تلزقش حرفين مع بعض.
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

استخدم وصف المنتج (short_description) اللي يطلع في نتيجة search_products بطريقتين:
- عشان تبيع بشكل أحسن: اذكر تفاصيل زي نوع القماش أو الخامة أو القصة أو المناسبة المناسبة له، بشكل طبيعي وحماسي بدون مبالغة، لما يكون في وصف مفيد متوفر.
- عشان تتأكد من الصور: لو الزبون بعتلك صورة، قارن اللي شايفه في الصورة (لون، خامة، شكل) مع وصف المنتجات في نتيجة البحث عشان تتأكد فعلاً هذا هو المنتج قبل ما تأكدله.

قواعد مهمة:
- استخدم search_products أي وقت الزبون يسأل عن منتج أو يوصف شي يبيه. لا تخترع أسماء منتجات أو أسعار من عندك.
- لما تسوي search_products، استخدم كلمة أساسية بسيطة (اسم المنتج بالمفرد، بدون صيغة الجمع) بدل الجملة كاملة — مثلاً "قميص" مو "قمصان بيضاء قطن".
- لو النتيجة رجعت فاضية أو ما فيها شي مناسب، جرب مرة ثانية بكلمة أبسط أو مرادف قبل ما تقول للزبون "ما عندنا". مثلاً لو "قمصان بيضاء" ما رجعت شي، جرب "قميص" لحاله.
- لو بعد أكثر من محاولة ما لقيت شي مناسب، هنا بس قول للزبون بصراحة إنه غير متوفر حالياً، واقترح عليه يشوف منتجات ثانية.
- لو في أكثر من نتيجة، اذكرهم للزبون باختصار وخليه يختار.
- كل منتج عنده variants (مقاسات/ألوان) بكمية حقيقية لكل واحد فيهم. لما الزبون يسأل عن مقاس أو لون معين، شوف الكمية المتوفرة بالضبط قبل ما تأكدله إنه متوفر.
- لما تضيف منتج للسلة (add_item_to_cart)، استخدم نص الـ variant بالضبط زي ما طلع في نتيجة search_products (مثلاً "أسود - M")، مو صيغة مختلفة أو مختصرة — هذا مهم عشان تحديث المخزون يشتغل صح.
- استخدم send_product_photo لو الزبون طلب يشوف صورة، أو لو يقولك "ابعتلي صورة" أو شي مشابه. لازم تستدعي الأداة فعلاً قبل ما تكتب أي جملة توحي إنك بعت صورة (زي "هذا هو المنتج") — ما تكتبش جملة كذا من غير ما تستخدم الأداة أولاً.
- بعض المنتجات عندها صور مختلفة لكل لون (شوف حقل images في نتيجة search_products). لو الزبون ذكر لون معين، ابعتله صورة هذا اللون بالضبط. لو ما ذكرش لون وفي أكثر من لون متوفر، اسأله أي لون يبي يشوف قبل ما تبعت.
- لما الزبون يأكد شي يبيه، استخدم add_item_to_cart.
- قبل ما تأكد الطلبية النهائية، لازم يكون عندك: اسم الزبون، رقم هاتفه، والعنوان. اسألهم لو ناقصين.
- لما كل شي كامل والزبون يأكد الطلبية، استخدم finalize_order مرة وحدة بس.
- بعد finalize_order، قول للزبون بأن الطلبية وصلت واشكره.
- استخدم request_human_help في هذي الحالات:
  - الزبون يبي يدفع بحوالة بنكية (مو نقدي عند التسليم) — قوله إن صاحب المحل بيتواصل معاه بتفاصيل الدفع، وما تعطيش أي تفاصيل بنكية بنفسك.
  - الزبون طلب صراحة يتكلم مع شخص حقيقي.
  - جربت أكثر من مرة تفهم شنو يبي الزبون وما قدرتش.
  - الزبون يبين عليه منزعج أو مستاء.
  بعد ما تستدعي الأداة، قول للزبون بلطف إن صاحب المحل بيتابع معاه قريب، ووقف — لا تكمل تحاول تحل المشكلة بنفسك.

رد دايما بشكل طبيعي كإنسان، بدون أي علامات أو JSON في الرسالة النهائية للزبون.
`.trim();

const tools = [
  {
    name: 'search_products',
    description: 'Search the store catalog by keyword. Use whenever the customer mentions or describes a product. Use a short, singular base-form keyword (e.g. "قميص" not "قمصان بيضاء") for the best match — you can call this more than once with different wording if the first search comes back empty. Results include a "variants" array with real, live quantities per size/color.',
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
    description: 'Send product photo(s) to the customer in the chat. Use when the customer asks to see a product, or it would help them decide. If the product has multiple photos for a color (e.g. front and back), all of them are sent. If the product has different photos per color (check the "images" field from search_products) and the customer mentioned or is considering a specific color, pass that color to get the right photos.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'The product id from a previous search_products result' },
        color: { type: 'string', description: 'The color name exactly as it appears in the product\'s "images" field, if the customer wants a specific color. Omit for the default photo.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'add_item_to_cart',
    description: 'Add a product the customer confirmed they want to their order. The "variant" field must exactly match a variant label returned by search_products (e.g. "أسود - M"), since it is used later to update real stock.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'string' },
        quantity: { type: 'number', default: 1 },
        variant: { type: 'string', description: 'Exact variant label from search_products, e.g. "أسود - M"' },
      },
      required: ['product_id', 'name', 'price', 'quantity', 'variant'],
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
    description: 'Call once, only when the cart is non-empty, customer info (name/phone/address) is complete, and the customer has confirmed they want to place the order. This notifies the store owner and reduces stock for each item ordered.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'request_human_help',
    description:
      'Escalate this conversation to the store owner and stop responding automatically until they resolve it. Use when: the customer explicitly asks for a human; you genuinely cannot understand what the customer wants after a couple of tries; the customer seems upset or frustrated; or the customer wants to pay via bank transfer (حوالة بنكية) — payment methods other than cash on delivery always need the owner.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Short reason, in Arabic, for the owner — e.g. "الزبون يبي يدفع بحوالة بنكية" or "ما قدرتش نفهم شنو يبي بعد عدة محاولات"' },
      },
      required: ['reason'],
    },
  },
];

async function executeTool(toolName, input, session, psid) {
  switch (toolName) {
    case 'search_products': {
      const results = await catalog.searchProducts(input.query);
      return results;
    }

    case 'send_product_photo': {
      const product = await catalog.getProduct(input.product_id);
      const colorPhotos = input.color && product?.images ? product.images[input.color] : null;
      const urls = colorPhotos && colorPhotos.length > 0 ? colorPhotos : (product?.image_url ? [product.image_url] : []);

      if (urls.length === 0) {
        return { sent: false, reason: 'no image available' };
      }

      for (const url of urls) {
        await messenger.sendImage(psid, url, session.pageAccessToken);
      }
      return { sent: true, count: urls.length, color: input.color || null };
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

      // Reduce real stock for each item — only happens here, at
      // confirmation time, never earlier.
      for (const item of session.cart) {
        if (item.product_id) {
          await catalog.decrementStock(item.product_id, item.variant, item.quantity);
        }
      }

      const summary = buildOrderSummary(session);
      await telegram.sendOrderSummary(summary);
      return { success: true };
    }

    case 'request_human_help': {
      session.needsHuman = true;
      session.humanHelpReason = input.reason || 'غير محدد';

      const alert = buildHumanHelpAlert(session, psid);
      session.pinnedMessageIds = {};

      for (const chatId of config.telegram.ownerChatIds) {
        const messageId = await telegram.sendMessage(chatId, alert);
        await telegram.pinMessage(chatId, messageId);
        session.pinnedMessageIds[chatId] = messageId;
      }

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
    ...session.cart.map((item) => {
      const total = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      const variant = item.variant ? ` (${item.variant})` : '';
      return (
        `• ${item.name}${variant}\n` +
        `  الكمية: ${item.quantity} — السعر للقطعة: ${item.price} د.ل — الإجمالي: ${total} د.ل`
      );
    }),
    '',
    `الاسم: ${session.customer.name || '—'}`,
    `الهاتف: ${session.customer.phone || '—'}`,
    `العنوان: ${session.customer.address || '—'}`,
  ];
  if (session.customer.notes) lines.push(`ملاحظات: ${session.customer.notes}`);
  return lines.join('\n');
}

// Pulls out a readable last-few-turns transcript from the raw message
// history — skipping tool_use/tool_result blocks, which aren't useful for
// a human skimming context quickly.
function extractRecentTranscript(session, maxTurns = 6) {
  const readable = [];

  for (const msg of session.history) {
    if (typeof msg.content === 'string') {
      readable.push(`${msg.role === 'user' ? 'الزبون' : 'البوت'}: ${msg.content.replace(/\n\n\[تذكير داخلي[\s\S]*?\]$/, '').trim()}`);
    } else if (Array.isArray(msg.content)) {
      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
      if (text) readable.push(`${msg.role === 'user' ? 'الزبون' : 'البوت'}: ${text}`);
    }
  }

  return readable.slice(-maxTurns).join('\n');
}

function buildHumanHelpAlert(session, psid) {
  const lines = [
    '🚨 عاجل — زبون ينتظرك الآن',
    '',
    `السبب: ${session.humanHelpReason}`,
    '',
    session.customer.name ? `الاسم: ${session.customer.name}` : null,
    session.customer.phone ? `الهاتف: ${session.customer.phone}` : null,
    '',
    'آخر رسائل:',
    extractRecentTranscript(session) || '(ما فيش محادثة سابقة)',
    '',
    'روح ماسنجر ورد عليه مباشرة. البوت وقف يرد عليه تلقائياً — قولي "استأنف" في هذا الشات بعد ما تخلص عشان يكمل معاه.',
  ].filter((l) => l !== null);

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
  'الزبون بعت صورة منتج يسأل عليه، ممكن تكون صورة عادية أو سكرين شوت لإعلان. شوف الصورة زين — ' +
  'لو فيها كتابة (اسم المنتج أو السعر)، اقرأها واستخدمها. حدد شنو المنتج (نوعه ولونه بإيجاز)، ' +
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
