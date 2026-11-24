import { scoreAnswers, resumeState } from "./assessment-core.mjs";

const STEPS = { question: "question", result: "result" };

function load(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "null");
  } catch {
    return null;
  }
}

function save(storageKey, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* private mode or quota: progress stays in memory for this visit */
  }
}

function clear(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

function h(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/**
 * Render one item at a time: choose, commit, see why, advance.
 * State is written after every commit so a reload resumes in place.
 */
export function init(root, bank, storageKey) {
  const state = resumeState(load(storageKey), bank);
  let index = state.index;
  let answers = state.answers;
  let revealed = answers[bank.items[index]?.id] !== undefined;
  let stage = STEPS.question;

  const live = h("p", { class: "assessment-live", "aria-live": "polite" });
  const stageNode = h("div", { class: "assessment-stage" });
  root.replaceChildren(live, stageNode);

  const announce = (message) => {
    live.textContent = message;
  };

  function commit(item, choice) {
    answers = { ...answers, [item.id]: choice };
    save(storageKey, { index, answers });
    revealed = true;
    render();
  }

  function advance() {
    const last = bank.items.length - 1;
    if (index >= last) {
      stage = STEPS.result;
    } else {
      index += 1;
      revealed = answers[bank.items[index].id] !== undefined;
    }
    save(storageKey, { index, answers });
    render();
  }

  function restart() {
    index = 0;
    answers = {};
    revealed = false;
    stage = STEPS.question;
    clear(storageKey);
    render();
  }

  function renderResult() {
    const result = scoreAnswers(answers, bank);
    const percent = Math.round(result.ratio * 100);
    const headline = result.pass ? "Passed" : "Not yet";
    const summary = `${result.correct} of ${result.total} correct (${percent}%).`;

    const misses = result.misses.length
      ? h(
          "ol",
          { class: "assessment-misses" },
          ...result.misses.map((miss) => {
            const item = bank.items.find((candidate) => candidate.id === miss.itemId);
            const teach = item?.teach
              ? h("a", { href: item.teach.href, text: item.teach.label || "Revisit" })
              : null;
            return h(
              "li",
              {},
              h("p", { text: item?.prompt ?? miss.itemId }),
              h("p", {
                class: "note",
                text: `You chose ${miss.chosen ?? "nothing"}; the answer is ${miss.answer}.`,
              }),
              ...(teach ? [teach] : []),
            );
          }),
        )
      : h("p", { class: "note", text: "Every item correct." });

    stageNode.replaceChildren(
      h("h2", { text: headline }),
      h("p", { text: summary }),
      misses,
      h(
        "p",
        { class: "assessment-actions" },
        h("button", { type: "button", class: "button", text: "Start over", onclick: restart }),
      ),
    );
    announce(`${headline}. ${summary}`);
  }

  function render() {
    if (stage === STEPS.result) {
      renderResult();
      return;
    }

    const item = bank.items[index];
    const chosen = answers[item.id];
    const isRevealed = revealed && chosen !== undefined;

    const fieldset = h("fieldset", { class: "assessment-item" });
    fieldset.append(
      h("legend", { text: `${index + 1} of ${bank.items.length}` }),
      h("p", { class: "assessment-prompt", text: item.prompt }),
    );

    const options = h("div", { class: "assessment-options" });
    for (const option of item.options) {
      const id = `item-${item.id}-${option.id}`;
      const input = h("input", { type: "radio", name: `item-${item.id}`, id, value: option.id });
      input.checked = chosen === option.id;
      input.disabled = isRevealed;
      input.addEventListener("change", () => {
        answers = { ...answers, [item.id]: option.id };
      });
      const label = h("label", { for: id }, input, h("span", { text: option.text }));
      if (isRevealed && option.id === item.answer) label.classList.add("is-correct");
      if (isRevealed && option.id === chosen && chosen !== item.answer) label.classList.add("is-wrong");
      options.append(label);
    }
    fieldset.append(options);

    const actions = h("div", { class: "assessment-actions" });
    if (!isRevealed) {
      const commitButton = h("button", { type: "button", class: "button", text: "Check answer" });
      commitButton.disabled = answers[item.id] === undefined;
      commitButton.addEventListener("click", () => {
        if (answers[item.id] === undefined) return;
        commit(item, answers[item.id]);
      });
      actions.append(commitButton);
    } else {
      const verdict = chosen === item.answer ? "Correct." : "Not quite.";
      const nextLabel = index === bank.items.length - 1 ? "See result" : "Next";
      const next = h("button", { type: "button", class: "button", text: nextLabel });
      next.addEventListener("click", advance);
      stageNode.replaceChildren(
        fieldset,
        h("p", { class: chosen === item.answer ? "assessment-verdict is-correct" : "assessment-verdict is-wrong", text: verdict }),
        h("p", { class: "assessment-explanation", text: item.explanation }),
        ...(item.teach ? [h("p", {}, h("a", { href: item.teach.href, text: item.teach.label || "Revisit this step" }))] : []),
        h("div", { class: "assessment-actions" }, next),
      );
      announce(`${verdict} ${item.explanation}`);
      return;
    }

    stageNode.replaceChildren(fieldset, actions);
    announce(`Question ${index + 1} of ${bank.items.length}. ${item.prompt}`);
  }

  render();
}

// The generated page carries the bank and its storage key; boot on load.
const root = document.getElementById("assessment");
const bankNode = document.getElementById("bank");
if (root && bankNode) {
  try {
    init(root, JSON.parse(bankNode.textContent), root.dataset.storageKey || "learning:assessment");
  } catch (error) {
    root.textContent = "This assessment could not load.";
    console.error(error);
  }
}
