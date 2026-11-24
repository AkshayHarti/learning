/**
 * Pure scoring and state logic for JSON item-bank assessments.
 * No DOM access: this module is imported by the browser bundle and by node tests.
 */

export const DEFAULT_PASS_RATIO = 0.7;

/**
 * @param {unknown} bank
 * @returns {string[]} one message per problem; empty means valid
 */
export function validateBank(bank) {
  if (!bank || typeof bank !== "object") return ["bank: must be an object"];

  const errors = [];
  if (!bank.id) errors.push("bank.id: is required");
  if (!bank.title) errors.push("bank.title: is required");
  if (bank.passRatio !== undefined && (typeof bank.passRatio !== "number" || bank.passRatio <= 0 || bank.passRatio > 1)) {
    errors.push("bank.passRatio: must be a number in (0, 1]");
  }
  if (!Array.isArray(bank.items) || bank.items.length === 0) {
    errors.push("bank.items: must be a non-empty array");
    return errors;
  }

  const seen = new Set();
  bank.items.forEach((item, index) => {
    const at = item?.id || `items[${index}]`;
    if (!item?.id) errors.push(`${at}.id: is required`);
    else if (seen.has(item.id)) errors.push(`${at}.id: duplicate item id`);
    else seen.add(item.id);

    if (!item?.prompt) errors.push(`${at}.prompt: is required`);

    if (!Array.isArray(item?.options) || item.options.length < 2) {
      errors.push(`${at}.options: must have at least two options`);
    }
    if (Array.isArray(item?.options)) {
      if (item.options.some((option) => !option?.id)) errors.push(`${at}.options: every option needs an id`);
      if (item.options.some((option) => !option?.text)) errors.push(`${at}.options: every option needs text`);
      const ids = item.options.map((option) => option?.id);
      if (!ids.includes(item.answer)) errors.push(`${at}.answer: "${item.answer}" is not one of the option ids`);
    }

    if (!item?.explanation) errors.push(`${at}.explanation: is required`);
  });

  return errors;
}

/**
 * @param {Record<string,string>} answers itemId → chosen option id
 * @param {object} bank
 * @returns {{ total: number, correct: number, ratio: number, pass: boolean, misses: {itemId:string, chosen:string|null, answer:string}[] }}
 */
export function scoreAnswers(answers, bank) {
  const items = bank?.items ?? [];
  const misses = [];
  let correct = 0;

  for (const item of items) {
    const chosen = answers?.[item.id];
    if (chosen === item.answer) correct += 1;
    else misses.push({ itemId: item.id, chosen: chosen ?? null, answer: item.answer });
  }

  const total = items.length;
  const ratio = total === 0 ? 0 : correct / total;
  const passRatio = typeof bank?.passRatio === "number" ? bank.passRatio : DEFAULT_PASS_RATIO;

  return { total, correct, ratio, pass: ratio >= passRatio, misses };
}

/**
 * Restore progress saved in localStorage, discarding anything the current bank
 * no longer contains so a stale save cannot inflate a score.
 *
 * @param {{ index?: number, answers?: Record<string,string> } | null} saved
 * @param {object} bank
 * @returns {{ index: number, answers: Record<string,string> }}
 */
export function resumeState(saved, bank) {
  const items = bank?.items ?? [];
  const ids = new Set(items.map((item) => item.id));

  const answers = {};
  for (const [itemId, choice] of Object.entries(saved?.answers ?? {})) {
    if (ids.has(itemId) && typeof choice === "string") answers[itemId] = choice;
  }

  const last = Math.max(0, items.length - 1);
  const raw = Number.isInteger(saved?.index) ? saved.index : 0;
  return { index: Math.min(Math.max(0, raw), last), answers };
}

/** Default storage key for a bank, used when the course has none. */
export function storageKeyFor(progressKey, bank) {
  return `${progressKey}:assessment:${bank.id}`;
}
