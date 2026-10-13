/** OpenAI-compatible adapter for the shared email worker. No Cloudflare AI fallback. */
export const EMAIL_AI_DAILY_LIMIT = 100;
export const EMAIL_AI_OUTPUT_LIMIT = 1200;
export async function reserveEmailAi(storage, now = Date.now()) {
 return storage.transaction(async (tx) => {
  const day = new Date(now).toISOString().slice(0, 10);
  const previous = await tx.get('agnes-daily-budget');
  const used = previous?.day === day ? previous.used : 0;
  if (used >= EMAIL_AI_DAILY_LIMIT) return false;
  await tx.put('agnes-daily-budget', {day, used: used + 1});
  return true;
 });
}
export function createAgnesBinding(env, getBudgetStub, request = fetch) {
 return { async run(_model, inputs, options = {}) {
  if (!env.AGNES_AI_KEY) throw new Error('Agnes AI is not configured; AI processing is paused.');
  if (!Array.isArray(inputs.messages) || inputs.image) throw new Error('Only text email analysis is supported.');
  // Reject oversized input before reserving spend; tools and message history share this cap.
  if (JSON.stringify(inputs).length > 48_000) throw new Error('Email AI context is too large; shorten the conversation.');
  const budget = await getBudgetStub();
  const reservation = await budget.fetch(new Request('https://internal/agnes-budget', {
   method: 'POST', headers: {Authorization: `Bearer ${env.AGNES_AI_KEY}`}
  }));
  if (!reservation.ok) throw new Error('Daily email AI budget exhausted or unavailable; AI processing is paused.');
  const requested = Number(inputs.max_tokens);
  const maxTokens = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), EMAIL_AI_OUTPUT_LIMIT) : EMAIL_AI_OUTPUT_LIMIT;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000);
  const result = await request('https://apihub.agnes-ai.com/v1/chat/completions', {
   method: 'POST', signal,
   headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env.AGNES_AI_KEY}`, 'User-Agent': 'EwinEmail/1.0'},
   body: JSON.stringify({model: 'agnes-3.0-flash', messages: inputs.messages, max_tokens: maxTokens,
    temperature: inputs.temperature ?? 0.15, ...(inputs.tools?.length ? {tools: inputs.tools} : {}), stream: false})
  });
  if (!result.ok) throw new Error(`Agnes email analysis unavailable (${result.status}); no AI fallback is permitted.`);
  const body = await result.json();
  if (!body.choices?.[0]?.message) throw new Error('Agnes returned no email analysis.');
  // Existing email SDK accepts OpenAI choices/tool_calls; checks also read response.
  return {...body, response: body.choices[0].message.content ?? ''};
 }};
}
