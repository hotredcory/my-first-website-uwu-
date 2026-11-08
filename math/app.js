(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const STORE_KEY = "math-test-prep-progress-v1";
  const TOPICS = {
    slope: "Slope & rate",
    forms: "Equation forms",
    graphing: "Graphing",
    intercepts: "Intercepts",
    domain: "Domain & range",
    "point-slope": "Point-slope form",
    lines: "Parallel & perpendicular",
    modeling: "Word problems",
    inequalities: "Inequalities"
  };
  const KEY_TOPIC = {
    slope: "slope",
    forms: "forms",
    graphing: "graphing",
    intercepts: "intercepts",
    "domain-range": "domain",
    "point-slope": "point-slope",
    "parallel-perpendicular": "lines",
    modeling: "modeling",
    inequalities: "inequalities"
  };
  const TOPIC_KEYS = Object.keys(TOPICS);
  const defaultState = { practiceAttempts: 0, practiceCorrect: 0, topics: [], lastTestScore: null, finalTests: 0 };

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return Object.assign({}, defaultState, saved, { topics: Array.isArray(saved.topics) ? saved.topics : [] });
    } catch (error) {
      return Object.assign({}, defaultState);
    }
  }

  let state = readState();
  let currentQuestion = null;
  let selectedPracticeAnswer = null;
  let practiceAnswerMode = "choice";
  let practiceFinished = false;
  let testIndex = 0;
  let testResponses = [];
  let testDrafts = [];
  let testSubmitted = false;
  let selectedTestAnswer = null;

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      // The lessons still work when browser storage is unavailable.
    }
  }

  function updateProgress() {
    const count = state.topics.filter((topic) => TOPIC_KEYS.includes(topic)).length;
    const percent = Math.round((count / TOPIC_KEYS.length) * 100);
    $("#progressFill").style.width = percent + "%";
    $("#progressPercent").textContent = percent + "%";
    $("#progressLabel").textContent = count + " of " + TOPIC_KEYS.length + " topic skills practiced";
    $("#topicProgress").setAttribute("aria-valuenow", String(count));
    $("#scoreLabel").textContent = state.practiceCorrect + " / " + state.practiceAttempts;
  }

  function rememberTopic(topic, correct) {
    state.practiceAttempts += 1;
    if (correct) {
      state.practiceCorrect += 1;
      if (topic && !state.topics.includes(topic)) state.topics.push(topic);
    }
    saveState();
    updateProgress();
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function shuffled(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function choicesFor(answer, distractors) {
    const result = [];
    [answer].concat(distractors || []).forEach((value) => {
      const text = String(value);
      if (!result.includes(text)) result.push(text);
    });
    return shuffled(result.slice(0, 4));
  }

  function formatFraction(numerator, denominator) {
    if (denominator < 0) {
      numerator *= -1;
      denominator *= -1;
    }
    if (numerator === 0) return "0";
    let a = Math.abs(numerator);
    let b = Math.abs(denominator);
    while (b) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    const divisor = a || 1;
    const top = numerator / divisor;
    const bottom = denominator / divisor;
    return bottom === 1 ? String(top) : top + "/" + bottom;
  }

  function linearForm(m, b) {
    let term = m === 1 ? "x" : m === -1 ? "-x" : String(m) + "x";
    if (b > 0) term += "+" + b;
    if (b < 0) term += String(b);
    return "y=" + term;
  }

  function normalized(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/−/g, "-")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/[×·]/g, "*")
      .replace(/\s+/g, "")
      .replace(/^y=/, "")
      .replace(/^m=/, "")
      .replace(/\.0+(?=$)/, "")
      .replace(/^-0(?=$)/, "0");
  }

  function numericValue(value) {
    const text = normalized(value);
    if (/^-?\d+\/-?\d+$/.test(text)) {
      const parts = text.split("/");
      const denominator = Number(parts[1]);
      return denominator === 0 ? null : Number(parts[0]) / denominator;
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    return null;
  }

  function answersMatch(expected, given) {
    if (normalized(expected) === normalized(given)) return true;
    const expectedNumber = numericValue(expected);
    const givenNumber = numericValue(given);
    return expectedNumber !== null && givenNumber !== null && Math.abs(expectedNumber - givenNumber) < 0.000001;
  }

  function pointsQuestion() {
    const x1 = randomInt(-3, 3);
    const dx = randomInt(1, 3);
    const y1 = randomInt(-3, 3);
    const slope = pick([-3, -2, -1, 0, 1, 2, 3]);
    const x2 = x1 + dx;
    const y2 = y1 + slope * dx;
    return {
      topic: "slope",
      label: "SLOPE FROM TWO POINTS",
      prompt: "Find the slope m of the line through (" + x1 + ", " + y1 + ") and (" + x2 + ", " + y2 + ").",
      answer: String(slope),
      choices: choicesFor(slope, [slope + 1, slope - 1, -slope]),
      hint: "Use m = (y₂ − y₁) ÷ (x₂ − x₁). Keep the y-values and x-values in the same order.",
      explanation: "Use the slope formula: (" + y2 + " − " + y1 + ") ÷ (" + x2 + " − " + x1 + ") = " + (y2 - y1) + " ÷ " + dx + " = " + slope + "."
    };
  }

  function tableQuestion() {
    const slope = pick([-3, -2, -1, 1, 2, 3]);
    const intercept = randomInt(-4, 4);
    const xs = [-1, 0, 1];
    const ys = xs.map((x) => slope * x + intercept);
    return {
      topic: "slope",
      label: "SLOPE FROM A TABLE",
      prompt: "Use the table to find the rate of change, or slope.",
      table: { xs: xs, ys: ys },
      answer: String(slope),
      choices: choicesFor(slope, [slope + 2, -slope, slope - 1]),
      hint: "Compare two rows. Divide the change in y by the change in x.",
      explanation: "From x = 0 to x = 1, y changes from " + ys[1] + " to " + ys[2] + ". So the slope is (" + ys[2] + " − " + ys[1] + ") ÷ (1 − 0) = " + slope + "."
    };
  }

  function slopeTypeQuestion() {
    const type = pick([
      { name: "positive", prompt: "A line rises as you move from left to right.", hint: "Think about whether y goes up or down as x gets larger.", explanation: "A line that rises from left to right has a positive slope." },
      { name: "negative", prompt: "A line falls as you move from left to right.", hint: "Think about whether y goes up or down as x gets larger.", explanation: "A line that falls from left to right has a negative slope." },
      { name: "zero", prompt: "A line is horizontal.", hint: "Horizontal lines have no rise as you move right.", explanation: "A horizontal line has slope 0 because its y-value never changes." },
      { name: "undefined", prompt: "A line is vertical.", hint: "A vertical line has a run of zero. You cannot divide by zero.", explanation: "A vertical line has undefined slope because the denominator in rise over run is 0." }
    ]);
    return {
      topic: "slope",
      label: "SLOPE TYPES",
      prompt: type.prompt + " What kind of slope does it have?",
      answer: type.name,
      choices: choicesFor(type.name, ["positive", "negative", "zero", "undefined"]),
      hint: type.hint,
      explanation: type.explanation
    };
  }

  function graphQuestion() {
    const slope = pick([-3, -2, -1, 0, 1, 2, 3]);
    const intercept = randomInt(-3, 3);
    return {
      topic: "graphing",
      label: "READ A GRAPH",
      prompt: "The graph shows a line. What is its slope?",
      graph: { slope: slope, intercept: intercept },
      answer: String(slope),
      choices: choicesFor(slope, [slope + 1, -slope, slope - 2]),
      hint: "Pick two grid points. Count the vertical change, then divide by the horizontal change.",
      explanation: "The plotted line is " + linearForm(slope, intercept) + ". Its slope is the coefficient of x, which is " + slope + "."
    };
  }

  function rewriteQuestion() {
    const a = pick([-5, -4, -3, -2, 2, 3, 4, 5]);
    const c = pick([-1, 1]);
    const d = randomInt(-8, 8);
    const equation = (a === 1 ? "" : a === -1 ? "-" : String(a)) + "x " + (c === 1 ? "+ y" : "- y") + " = " + d;
    const slope = -a / c;
    const intercept = d / c;
    const answer = formatFraction(-a, c);
    return {
      topic: "forms",
      label: "REARRANGE AN EQUATION",
      prompt: "Rewrite " + equation + " in y = mx + b form. What is its slope m?",
      answer: answer,
      choices: choicesFor(answer, [String(slope + 1), String(-slope), String(slope - 2)]),
      hint: "Move the x-term to the right, then divide every term by the coefficient of y.",
      explanation: "Move " + (a === 1 ? "x" : a === -1 ? "−x" : a + "x") + " to the right and divide by " + c + ". The equation becomes " + linearForm(slope, intercept) + ", so m = " + answer + "."
    };
  }

  function graphingQuestion() {
    const slope = pick([-3, -2, -1, 1, 2, 3]);
    const intercept = randomInt(-3, 3);
    return {
      topic: "graphing",
      label: "GRAPH A LINE",
      prompt: "The graph shows y = " + slope + "x " + (intercept >= 0 ? "+ " + intercept : "− " + Math.abs(intercept)) + ". What is the y-value when x = 1?",
      graph: { slope: slope, intercept: intercept },
      answer: String(slope + intercept),
      choices: choicesFor(slope + intercept, [intercept, slope, slope + intercept + 2]),
      hint: "Find the point on the line directly above or below x = 1.",
      explanation: "At x = 1, y = " + slope + "(1) + (" + intercept + ") = " + (slope + intercept) + ". The graph includes the point (1, " + (slope + intercept) + ")."
    };
  }

  function interceptQuestion() {
    const slope = pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const zero = randomInt(-3, 3);
    const intercept = -slope * zero;
    const askY = Math.random() < 0.5;
    const answer = askY ? String(intercept) : String(zero);
    return {
      topic: "intercepts",
      label: askY ? "Y-INTERCEPT" : "X-INTERCEPT",
      prompt: askY
        ? "For " + linearForm(slope, intercept) + ", what is the y-coordinate of the y-intercept?"
        : "For " + linearForm(slope, intercept) + ", what is the x-coordinate of the x-intercept?",
      answer: answer,
      choices: choicesFor(answer, [String(Number(answer) + 2), String(-Number(answer)), String(Number(answer) - 1)]),
      hint: askY ? "Set x = 0. The y-value that remains is the y-intercept." : "Set y = 0 and solve the equation for x.",
      explanation: askY
        ? "Set x = 0 in " + linearForm(slope, intercept) + ". Then y = " + intercept + ", so the y-intercept is (0, " + intercept + ")."
        : "Set y = 0 in " + linearForm(slope, intercept) + ": 0 = " + linearForm(slope, intercept).slice(2) + ". Solving gives x = " + zero + ", so the x-intercept is (" + zero + ", 0)."
    };
  }

  function domainQuestion() {
    if (Math.random() < 0.5) {
      const hours = randomInt(4, 12);
      const rate = randomInt(2, 5);
      const start = randomInt(3, 12);
      const end = rate * hours + start;
      return {
        topic: "domain",
        label: "DOMAIN & RANGE IN CONTEXT",
        prompt: "A service costs C = " + rate + "h + " + start + " dollars for h hours, with 0 ≤ h ≤ " + hours + ". What is the range of C?",
        answer: start + " <= C <= " + end,
        choices: choicesFor(start + " ≤ C ≤ " + end, ["0 ≤ C ≤ " + end, start + " ≤ h ≤ " + hours, "all real numbers"]),
        hint: "Evaluate the cost at the smallest allowed h and at the largest allowed h.",
        explanation: "At h = 0 the cost is $" + start + ". At h = " + hours + " the cost is $" + end + ". So " + start + " ≤ C ≤ " + end + "."
      };
    }
    const askDomain = Math.random() < 0.5;
    return {
      topic: "domain",
      label: askDomain ? "DOMAIN" : "RANGE",
      prompt: "For the non-vertical, non-horizontal line y = 2x − 3, what is its " + (askDomain ? "domain" : "range") + "?",
      answer: "all real numbers",
      choices: choicesFor("All real numbers", ["x ≥ 0", "y ≥ 0", "only whole numbers"]),
      hint: "A line with no restrictions continues forever in both directions.",
      explanation: "The line extends forever left and right and also reaches every y-value. Its " + (askDomain ? "domain is all real x-values" : "range is all real y-values") + "."
    };
  }

  function pointSlopeQuestion() {
    const slope = pick([-3, -2, -1, 1, 2, 3]);
    const x = randomInt(-3, 3);
    const y = randomInt(-3, 3);
    const xPart = x > 0 ? "x - " + x : x < 0 ? "x + " + Math.abs(x) : "x";
    const yPart = y > 0 ? "y - " + y : y < 0 ? "y + " + Math.abs(y) : "y";
    const right = (slope === 1 ? "" : slope === -1 ? "-" : slope) + "(" + xPart + ")";
    const answer = yPart + " = " + right;
    return {
      topic: "point-slope",
      label: "POINT-SLOPE FORM",
      prompt: "Write point-slope form for a line with slope " + slope + " through (" + x + ", " + y + ").",
      answer: answer,
      choices: choicesFor(answer, ["y = " + slope + "x + " + y, yPart + " = " + slope + "(x + " + x + ")", "y - " + x + " = " + slope + "(x - " + y + ")"]),
      hint: "Use y − y₁ = m(x − x₁). Substitute the point exactly as given.",
      explanation: "Put m = " + slope + " and (" + x + ", " + y + ") into y − y₁ = m(x − x₁): " + answer + "."
    };
  }

  function lineRelationshipQuestion() {
    const slope = pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const parallel = Math.random() < 0.5;
    const answer = parallel ? String(slope) : formatFraction(-1, slope);
    return {
      topic: "lines",
      label: parallel ? "PARALLEL LINES" : "PERPENDICULAR LINES",
      prompt: "A line has slope " + slope + ". What slope would a " + (parallel ? "parallel" : "perpendicular") + " line have?",
      answer: answer,
      choices: choicesFor(answer, [String(-slope), String(slope + 1), formatFraction(1, slope)]),
      hint: parallel ? "Parallel lines keep the same slope." : "For perpendicular lines, flip the fraction and change its sign.",
      explanation: parallel
        ? "Parallel lines have equal slopes, so the answer is " + slope + "."
        : "The negative reciprocal of " + slope + " is " + formatFraction(-1, slope) + "."
    };
  }

  function modelingQuestion() {
    const start = randomInt(4, 14);
    const rate = randomInt(2, 6);
    const hours = randomInt(2, 7);
    return {
      topic: "modeling",
      label: "WRITE A LINEAR MODEL",
      prompt: "A bike rental costs $" + start + " to unlock plus $" + rate + " per hour. Write total cost C after h hours.",
      answer: "C=" + rate + "h+" + start,
      choices: choicesFor("C = " + rate + "h + " + start, ["rate" + " + " + start + "h", "C = " + start + "h + " + rate, "C = " + rate + "h - " + start]),
      hint: "The repeated hourly cost is the rate (slope). The unlock fee is the starting value.",
      explanation: "The cost starts at $" + start + " and grows by $" + rate + " each hour, so C = " + rate + "h + " + start + "."
    };
  }

  function inequalityQuestion() {
    const item = pick([
      { sign: ">", boundary: "Dashed", direction: "above", solid: false, above: true },
      { sign: "<", boundary: "Dashed", direction: "below", solid: false, above: false },
      { sign: "≥", boundary: "Solid", direction: "above", solid: true, above: true },
      { sign: "≤", boundary: "Solid", direction: "below", solid: true, above: false }
    ]);
    const answer = item.boundary + " line; shade " + item.direction;
    return {
      topic: "inequalities",
      label: "GRAPH AN INEQUALITY",
      prompt: "For y " + item.sign + " x + 2, choose the correct boundary and shaded side.",
      answer: answer,
      choices: choicesFor(answer, [
        (item.solid ? "Dashed" : "Solid") + " line; shade " + item.direction,
        item.boundary + " line; shade " + (item.above ? "below" : "above"),
        "Dashed line; shade both sides"
      ]),
      hint: "An equal bar makes the boundary solid. Greater-than shades above; less-than shades below.",
      explanation: item.boundary + " boundary: the symbol " + item.sign + " " + (item.solid ? "includes equality, so draw a solid line" : "does not include equality, so draw a dashed line") + ". Shade " + item.direction + " the line."
    };
  }

  const factories = {
    "slope-points": pointsQuestion,
    "slope-table": tableQuestion,
    "slope-types": slopeTypeQuestion,
    "slope-graph": graphQuestion,
    forms: rewriteQuestion,
    graphing: graphingQuestion,
    intercepts: interceptQuestion,
    "domain-range": domainQuestion,
    "point-slope": pointSlopeQuestion,
    "parallel-perpendicular": lineRelationshipQuestion,
    modeling: modelingQuestion,
    inequalities: inequalityQuestion
  };
  const practiceKeys = ["slope", "forms", "graphing", "intercepts", "domain-range", "point-slope", "parallel-perpendicular", "modeling", "inequalities"];

  function makeQuestion(key) {
    if (key === "mixed") key = pick(practiceKeys);
    if (key === "slope") key = pick(["slope-points", "slope-table", "slope-types", "slope-graph"]);
    return factories[key]();
  }

  function drawGraph(svg, slope, intercept) {
    if (!svg) return;
    const width = svg.viewBox.baseVal.width || 360;
    const height = svg.viewBox.baseVal.height || 300;
    const left = width * 0.105;
    const right = width * 0.95;
    const top = height * 0.055;
    const bottom = height * 0.88;
    const sx = (x) => left + ((x + 5) / 10) * (right - left);
    const sy = (y) => bottom - ((y + 5) / 10) * (bottom - top);
    let markup = "";
    for (let value = -5; value <= 5; value += 1) {
      const x = sx(value);
      const y = sy(value);
      markup += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + bottom + '" stroke="#e7ebf2" stroke-width="1"/>';
      markup += '<line x1="' + left + '" y1="' + y + '" x2="' + right + '" y2="' + y + '" stroke="#e7ebf2" stroke-width="1"/>';
      if (value !== 0) {
        markup += '<text x="' + x + '" y="' + (bottom + 15) + '" text-anchor="middle" fill="#8390a2" font-size="9">' + value + "</text>";
        markup += '<text x="' + (left - 10) + '" y="' + (y + 3) + '" text-anchor="end" fill="#8390a2" font-size="9">' + value + "</text>";
      }
    }
    markup += '<line x1="' + sx(0) + '" y1="' + top + '" x2="' + sx(0) + '" y2="' + bottom + '" stroke="#8290a4" stroke-width="1.5"/>';
    markup += '<line x1="' + left + '" y1="' + sy(0) + '" x2="' + right + '" y2="' + sy(0) + '" stroke="#8290a4" stroke-width="1.5"/>';
    markup += '<text x="' + (right - 2) + '" y="' + (bottom + 25) + '" fill="#65758c" font-size="10">x</text>';
    markup += '<text x="' + (left - 16) + '" y="' + (top + 8) + '" fill="#65758c" font-size="10">y</text>';

    const points = [];
    function addPoint(x, y) {
      if (x < -5.0001 || x > 5.0001 || y < -5.0001 || y > 5.0001) return;
      if (!points.some((point) => Math.abs(point[0] - x) < 0.0001 && Math.abs(point[1] - y) < 0.0001)) points.push([x, y]);
    }
    [-5, 5].forEach((x) => addPoint(x, slope * x + intercept));
    if (Math.abs(slope) > 0.00001) [-5, 5].forEach((y) => addPoint((y - intercept) / slope, y));
    if (points.length >= 2) {
      markup += '<line x1="' + sx(points[0][0]) + '" y1="' + sy(points[0][1]) + '" x2="' + sx(points[1][0]) + '" y2="' + sy(points[1][1]) + '" stroke="#3769d6" stroke-width="3.5" stroke-linecap="round"/>';
      points.forEach((point) => {
        if (Math.abs(point[0]) < 4.999 && Math.abs(point[1]) < 4.999) {
          markup += '<circle cx="' + sx(point[0]) + '" cy="' + sy(point[1]) + '" r="3.2" fill="#fff" stroke="#3769d6" stroke-width="2"/>';
        }
      });
    } else if (slope === 0 && Math.abs(intercept) <= 5) {
      markup += '<line x1="' + left + '" y1="' + sy(intercept) + '" x2="' + right + '" y2="' + sy(intercept) + '" stroke="#3769d6" stroke-width="3.5" stroke-linecap="round"/>';
    }
    svg.innerHTML = markup;
    svg.setAttribute("aria-label", "Graph of " + linearForm(slope, intercept) + " on a coordinate grid from negative five to five");
  }

  function renderTable(table) {
    if (!table) return "";
    let html = '<table class="question-table" aria-label="Values table"><thead><tr><th>x</th>';
    table.xs.forEach((value) => { html += "<th>" + value + "</th>"; });
    html += '</tr></thead><tbody><tr><th>y</th>';
    table.ys.forEach((value) => { html += "<td>" + value + "</td>"; });
    html += "</tr></tbody></table>";
    return html;
  }

  function updatePracticeMode() {
    const isChoice = practiceAnswerMode === "choice";
    $("#choiceList").hidden = !isChoice;
    $("#writtenForm").hidden = isChoice;
    $("#chooseMode").setAttribute("aria-pressed", String(isChoice));
    $("#writeMode").setAttribute("aria-pressed", String(!isChoice));
    $("#practiceModeHint").textContent = isChoice ? "Pick one answer, or type it yourself." : "Type an answer, or switch back to multiple choice.";
  }

  function renderPracticeQuestion() {
    if (!currentQuestion) return;
    selectedPracticeAnswer = null;
    practiceFinished = false;
    $("#practiceTopic").textContent = currentQuestion.label;
    $("#practicePrompt").textContent = currentQuestion.prompt;
    $("#practiceTableWrap").innerHTML = renderTable(currentQuestion.table);
    $("#practiceGraphWrap").hidden = !currentQuestion.graph;
    if (currentQuestion.graph) drawGraph($("#practiceGraph"), currentQuestion.graph.slope, currentQuestion.graph.intercept);
    $("#choiceList").innerHTML = "";
    (currentQuestion.choices || []).forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.innerHTML = '<span class="choice-dot">' + String.fromCharCode(65 + index) + "</span>";
      const text = document.createElement("span");
      text.textContent = choice;
      button.appendChild(text);
      button.addEventListener("click", () => {
        if (practiceFinished) return;
        selectedPracticeAnswer = choice;
        document.querySelectorAll("#choiceList .choice").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
      });
      $("#choiceList").appendChild(button);
    });
    $("#writtenAnswer").value = "";
    $("#writtenAnswer").disabled = false;
    $("#hintText").textContent = currentQuestion.hint;
    $("#hintText").hidden = true;
    $("#practiceFeedback").hidden = true;
    $("#practiceFeedback").className = "feedback";
    $("#checkPractice").hidden = false;
    $("#similarQuestion").hidden = true;
    $("#nextQuestion").hidden = true;
    updatePracticeMode();
    $("#practiceAttempts").textContent = state.practiceCorrect + " correct out of " + state.practiceAttempts + " answered";
  }

  function checkPractice() {
    if (practiceFinished) return;
    const given = practiceAnswerMode === "choice" ? selectedPracticeAnswer : $("#writtenAnswer").value.trim();
    const feedback = $("#practiceFeedback");
    if (!given) {
      feedback.hidden = false;
      feedback.className = "feedback incorrect";
      feedback.innerHTML = "<strong>Choose or type an answer first.</strong>";
      return;
    }
    const correct = answersMatch(currentQuestion.answer, given);
    practiceFinished = true;
    rememberTopic(currentQuestion.topic, correct);
    feedback.hidden = false;
    feedback.className = "feedback " + (correct ? "" : "incorrect");
    feedback.innerHTML = "<strong>" + (correct ? "That's right!" : "Not quite. The answer is " + currentQuestion.answer + ".") + "</strong>" + currentQuestion.explanation;
    document.querySelectorAll("#choiceList .choice").forEach((item) => { item.disabled = true; });
    $("#writtenAnswer").disabled = true;
    $("#checkPractice").hidden = true;
    $("#similarQuestion").hidden = correct;
    $("#nextQuestion").hidden = !correct;
    $("#practiceAttempts").textContent = state.practiceCorrect + " correct out of " + state.practiceAttempts + " answered";
  }

  function renderTestQuestion() {
    const question = testQuestions[testIndex];
    $("#testCounter").textContent = "Question " + (testIndex + 1) + " of " + testQuestions.length;
    $("#testFill").style.width = ((testIndex + (testResponses[testIndex] ? 1 : 0)) / testQuestions.length * 100) + "%";
    $("#testPrompt").textContent = question.prompt;
    $("#testChoices").innerHTML = "";
    $("#testChoices").hidden = !question.choices;
    $("#testWrittenForm").hidden = Boolean(question.choices);
    $("#testFeedback").hidden = true;
    $("#testFeedback").textContent = "";
    const response = testResponses[testIndex];
    const draft = response ? response.given : testDrafts[testIndex];
    selectedTestAnswer = response ? response.given : null;
    if (question.choices) {
      question.choices.forEach((choice, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        const letter = document.createElement("span");
        letter.className = "choice-dot";
        letter.textContent = String.fromCharCode(65 + index);
        const label = document.createElement("span");
        label.textContent = choice;
        button.append(letter, label);
        if (draft === choice) button.classList.add("selected");
        button.disabled = Boolean(response);
        button.addEventListener("click", () => {
          if (response) return;
          selectedTestAnswer = choice;
          testDrafts[testIndex] = choice;
          document.querySelectorAll("#testChoices .choice").forEach((item) => item.classList.remove("selected"));
          button.classList.add("selected");
        });
        $("#testChoices").appendChild(button);
      });
    } else {
      $("#testWrittenAnswer").value = draft || "";
      $("#testWrittenAnswer").disabled = Boolean(response);
    }
    $("#testBack").disabled = testIndex === 0;
    $("#testNext").textContent = response ? (testIndex === testQuestions.length - 1 ? "See results" : "Next question") : "Check answer";
    if (response) {
      const correct = answersMatch(question.answer, response.given);
      $("#testFeedback").hidden = false;
      $("#testFeedback").textContent = (correct ? "Correct. " : "Review: the answer is " + question.answer + ". ") + question.explanation;
    }
  }

  const testQuestions = [
    { topic: "slope", prompt: "In y = −3x + 5, what is the slope m?", answer: "-3", choices: ["−3", "5", "3", "−5"], explanation: "In y = mx + b, m is the coefficient of x. Here m = −3." },
    { topic: "slope", prompt: "Find the slope through (1, 2) and (4, 8).", answer: "2", choices: ["2", "3", "−2", "6"], explanation: "m = (8 − 2) ÷ (4 − 1) = 6 ÷ 3 = 2." },
    { topic: "slope", prompt: "A table has x-values 0, 1, 2 and y-values 6, 3, 0. What is the slope?", answer: "-3", choices: ["−3", "3", "−6", "6"], explanation: "Each time x increases by 1, y decreases by 3. The slope is −3." },
    { topic: "slope", prompt: "What kind of slope does the vertical line x = 4 have?", answer: "undefined", choices: ["Positive", "Negative", "Zero", "Undefined"], explanation: "A vertical line has run 0, so the slope would require division by zero. It is undefined." },
    { topic: "forms", prompt: "Rewrite 2x + 3y = 12 as y = mx + b. What is the slope?", answer: "-2/3", explanation: "Subtract 2x: 3y = −2x + 12. Divide by 3: y = −⅔x + 4, so m = −⅔." },
    { topic: "graphing", prompt: "Which point lies on y = 2x − 1?", answer: "(1, 1)", choices: ["(0, 1)", "(1, 1)", "(2, 2)", "(−1, 1)"], explanation: "Substitute x = 1: y = 2(1) − 1 = 1, so (1, 1) is on the line." },
    { topic: "graphing", prompt: "For y = −½x + 4, start at the y-intercept and move 2 units right. What point do you reach?", answer: "(2, 3)", choices: ["(2, 3)", "(2, 5)", "(1, 2)", "(4, 2)"], explanation: "The y-intercept is (0, 4). A slope of −½ means down 1 for every 2 right, so you reach (2, 3)." },
    { topic: "intercepts", prompt: "What is the y-intercept of y = −4x + 9?", answer: "(0, 9)", choices: ["(0, 9)", "(9, 0)", "(0, −4)", "(−4, 0)"], explanation: "Set x = 0. Then y = 9, so the y-intercept is (0, 9)." },
    { topic: "intercepts", prompt: "What is the x-intercept of 2x + y = 6?", answer: "(3, 0)", choices: ["(6, 0)", "(0, 6)", "(3, 0)", "(0, 3)"], explanation: "Set y = 0: 2x = 6, so x = 3. The x-intercept is (3, 0)." },
    { topic: "domain", prompt: "What is the domain of the unrestricted line y = 2x + 1?", answer: "all real numbers", choices: ["All real numbers", "x ≥ 0", "x ≤ 1", "Only whole numbers"], explanation: "The line continues forever left and right, so every real x-value is allowed." },
    { topic: "domain", prompt: "What is the range of the unrestricted line y = 2x + 1?", answer: "all real numbers", choices: ["All real numbers", "y ≥ 0", "y ≤ 1", "Only whole numbers"], explanation: "Because the line is not horizontal, it reaches every real y-value." },
    { topic: "point-slope", prompt: "Write point-slope form for a line with slope −2 through (3, 4).", answer: "y-4=-2(x-3)", explanation: "Use y − y₁ = m(x − x₁). Substituting m = −2 and (3, 4) gives y − 4 = −2(x − 3)." },
    { topic: "lines", prompt: "A line has slope 5/3. What is the slope of a parallel line?", answer: "5/3", choices: ["5/3", "−5/3", "3/5", "−3/5"], explanation: "Parallel lines have the same slope, so it is 5/3." },
    { topic: "lines", prompt: "A line has slope −4. What is the slope of a perpendicular line?", answer: "1/4", explanation: "Flip −4/1 and change the sign. The negative reciprocal is 1/4." },
    { topic: "modeling", prompt: "A rental costs $8 to unlock and $3 per hour. Write the total cost C for h hours.", answer: "C=3h+8", explanation: "The hourly rate is the slope and the unlock fee is the starting value: C = 3h + 8." },
    { topic: "inequalities", prompt: "For y ≥ x + 2, how should the boundary line be drawn, and which side is shaded?", answer: "Solid line; shade above", choices: ["Solid line; shade above", "Dashed line; shade above", "Solid line; shade below", "Dashed line; shade below"], explanation: "The bar in ≥ means the boundary is included, so draw a solid line. Greater-than shades above the line." }
  ];

  function startTest() {
    testIndex = 0;
    testResponses = [];
    testDrafts = [];
    testSubmitted = false;
    selectedTestAnswer = null;
    $("#testIntro").hidden = true;
    $("#testResults").hidden = true;
    $("#testRunner").hidden = false;
    renderTestQuestion();
  }

  function submitTestAnswer() {
    const existing = testResponses[testIndex];
    if (existing) {
      if (testIndex < testQuestions.length - 1) {
        testIndex += 1;
        renderTestQuestion();
      } else {
        finishTest();
      }
      return;
    }
    const question = testQuestions[testIndex];
    const given = question.choices ? selectedTestAnswer : $("#testWrittenAnswer").value.trim();
    if (!given) {
      $("#testFeedback").textContent = "Choose or type an answer before continuing.";
      $("#testFeedback").hidden = false;
      return;
    }
    testDrafts[testIndex] = given;
    testResponses[testIndex] = { given: given, correct: answersMatch(question.answer, given) };
    if (testResponses[testIndex].correct && !state.topics.includes(question.topic)) state.topics.push(question.topic);
    saveState();
    updateProgress();
    testSubmitted = true;
    renderTestQuestion();
  }

  function finishTest() {
    const score = testResponses.filter((response, index) => response && response.correct).length;
    state.lastTestScore = score;
    state.finalTests += 1;
    saveState();
    $("#testRunner").hidden = true;
    $("#testResults").hidden = false;
    $("#testResults").innerHTML = "";

    const scoreRow = document.createElement("div");
    scoreRow.className = "result-score";
    const scoreNumber = document.createElement("div");
    scoreNumber.className = "score-number";
    scoreNumber.textContent = score + "/" + testQuestions.length;
    const scoreText = document.createElement("div");
    const resultHeading = document.createElement("h3");
    resultHeading.textContent = score >= 13 ? "Strong work!" : score >= 9 ? "Good progress!" : "Keep practicing!";
    const resultDescription = document.createElement("p");
    resultDescription.textContent = "You answered " + score + " of " + testQuestions.length + " correctly. Review any missed steps below, then try again when you're ready.";
    scoreText.append(resultHeading, resultDescription);
    scoreRow.append(scoreNumber, scoreText);
    $("#testResults").appendChild(scoreRow);

    const review = document.createElement("div");
    review.className = "review-list";
    testQuestions.forEach((question, index) => {
      const response = testResponses[index] || { given: "No answer", correct: false };
      const item = document.createElement("article");
      item.className = "review-item " + (response.correct ? "correct" : "wrong");
      const title = document.createElement("strong");
      title.textContent = (index + 1) + ". " + question.prompt;
      const detail = document.createElement("p");
      detail.textContent = "Your answer: " + response.given + ". Correct answer: " + question.answer + ". " + question.explanation;
      item.append(title, detail);
      review.appendChild(item);
    });
    $("#testResults").appendChild(review);
    const retake = document.createElement("button");
    retake.type = "button";
    retake.className = "primary-button";
    retake.textContent = "Retake the test";
    retake.addEventListener("click", startTest);
    $("#testResults").appendChild(retake);
  }

  $("#practiceSkill").addEventListener("change", () => {
    currentQuestion = makeQuestion($("#practiceSkill").value);
    renderPracticeQuestion();
  });
  $("#newQuestion").addEventListener("click", () => {
    currentQuestion = makeQuestion($("#practiceSkill").value);
    renderPracticeQuestion();
  });
  $("#similarQuestion").addEventListener("click", () => {
    const skill = $("#practiceSkill").value;
    const mixedAliases = { domain: "domain-range", lines: "parallel-perpendicular" };
    currentQuestion = makeQuestion(skill === "mixed" ? (mixedAliases[currentQuestion.topic] || currentQuestion.topic) : skill);
    renderPracticeQuestion();
  });
  $("#nextQuestion").addEventListener("click", () => {
    currentQuestion = makeQuestion($("#practiceSkill").value);
    renderPracticeQuestion();
  });
  $("#checkPractice").addEventListener("click", checkPractice);
  $("#writtenForm").addEventListener("submit", (event) => {
    event.preventDefault();
    checkPractice();
  });
  $("#hintButton").addEventListener("click", () => { $("#hintText").hidden = !$("#hintText").hidden; });
  $("#chooseMode").addEventListener("click", () => { practiceAnswerMode = "choice"; updatePracticeMode(); });
  $("#writeMode").addEventListener("click", () => { practiceAnswerMode = "written"; updatePracticeMode(); });
  document.querySelectorAll("[data-practice]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#practiceSkill").value = button.getAttribute("data-practice");
      currentQuestion = makeQuestion($("#practiceSkill").value);
      renderPracticeQuestion();
      $("#practice").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  $("#graphSlope").addEventListener("input", updateMainGraph);
  $("#graphIntercept").addEventListener("input", updateMainGraph);
  $("#startTest").addEventListener("click", startTest);
  $("#testNext").addEventListener("click", submitTestAnswer);
  $("#testBack").addEventListener("click", () => {
    if (testIndex > 0) {
      testIndex -= 1;
      renderTestQuestion();
    }
  });
  $("#testWrittenForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submitTestAnswer();
  });

  function updateMainGraph() {
    const slope = Number($("#graphSlope").value);
    const intercept = Number($("#graphIntercept").value);
    if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return;
    drawGraph($("#linearGraph"), slope, intercept);
    let term = slope === 1 ? "x" : slope === -1 ? "−x" : slope + "x";
    if (intercept > 0) term += " + " + intercept;
    if (intercept < 0) term += " − " + Math.abs(intercept);
    $("#graphEquation").textContent = "y = " + term;
  }

  updateProgress();
  currentQuestion = makeQuestion("mixed");
  renderPracticeQuestion();
  updateMainGraph();
})();
