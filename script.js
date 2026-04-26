console.log("Timer JS is loaded!");

const BASIC_COLORS = ["#ff1a1a", "#ff8c00", "#f8e71c", "#39d353", "#2f81f7", "#a371f7", "#ffffff"];
const AUDIO_PATHS = {
  start: "Audio/Start.mp3",
  warning10s: "Audio/10sWarning.mp3",
};

const setupScreenEl = document.getElementById("setupScreen");
const timerScreenEl = document.getElementById("timerScreen");
const blockListEl = document.getElementById("blockList");
const addBlockButtonEl = document.getElementById("addBlockButton");
const editBlocksButtonEl = document.getElementById("editBlocksButton");
const playButtonEl = document.getElementById("playButton");
const backToSetupButtonEl = document.getElementById("backToSetupButton");
const fullscreenButtonEl = document.getElementById("fullscreenButton");
const timerControlsEl = document.getElementById("timerControls");
const continueButtonEl = document.getElementById("continueButton");
const timerBlockNameEl = document.getElementById("timerBlockName");
const timerRoundCounterEl = document.getElementById("timerRoundCounter");
const timerMinutesEl = document.getElementById("timerMinutes");
const timerSecondsEl = document.getElementById("timerSeconds");
const timerColonEl = timerScreenEl.querySelector(".countdown-colon");

const appState = {
  blocks: [
    {
      id: crypto.randomUUID(),
      type: "exercise",
      name: "exercise",
      durationSeconds: 60,
      color: "#ff1a1a",
    },
    {
      id: crypto.randomUUID(),
      type: "break",
      name: "break",
      durationSeconds: 30,
      color: "#2f81f7",
    },
  ],
  isEditMode: false,
  selectingRepeatBlockId: null,
  addMenuOpen: false,
  activeTimerId: null,
  playback: null,
  hideControlsTimeoutId: null,
  audio: {
    start: new Audio(AUDIO_PATHS.start),
    warning10s: new Audio(AUDIO_PATHS.warning10s),
  },
};

function initializeAdsenseUnits() {
  // If AdSense script has not loaded yet, do nothing.
  // This prevents ad init from interfering with timer logic.
  if (!("adsbygoogle" in window)) {
    return;
  }

  const adUnits = document.querySelectorAll(".adsbygoogle");
  adUnits.forEach((unit) => {
    if (unit.dataset.adsInitialized === "true") return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      unit.dataset.adsInitialized = "true";
    } catch {
      // Ignore AdSense initialization failures in local/dev contexts.
    }
  });
}

function isTimedBlockType(blockType) {
  return blockType === "exercise" || blockType === "break";
}

function toMMSSParts(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function parseDurationInputToSeconds(value) {
  const normalized = value.trim();
  if (!normalized) return NaN;
  const parts = normalized.split(":").map((part) => part.trim());
  if (parts.some((part) => !/^\d+$/.test(part))) return NaN;
  if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number);
    if (seconds > 59) return NaN;
    return minutes * 60 + seconds;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);
    if (minutes > 59 || seconds > 59) return NaN;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return NaN;
}

function formatSecondsToDurationInput(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function closeAnyColorPicker() {
  const picker = document.querySelector(".basic-color-picker");
  if (picker) picker.remove();
}

function closeAddMenu() {
  const menu = document.querySelector(".add-menu");
  if (menu) menu.remove();
  appState.addMenuOpen = false;
}

function openColorPicker(anchorElement, blockId) {
  closeAnyColorPicker();
  closeAddMenu();
  const picker = document.createElement("div");
  picker.className = "basic-color-picker";
  BASIC_COLORS.forEach((hexColor) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch";
    swatch.style.background = hexColor;
    swatch.addEventListener("click", () => {
      const block = appState.blocks.find((item) => item.id === blockId);
      if (!block || !isTimedBlockType(block.type)) return;
      block.color = hexColor;
      renderBlockList();
      closeAnyColorPicker();
    });
    picker.appendChild(swatch);
  });
  const box = anchorElement.getBoundingClientRect();
  picker.style.top = `${box.bottom + 8}px`;
  picker.style.left = `${box.left}px`;
  document.body.appendChild(picker);
}

function createNameEditable(block) {
  const wrapper = document.createElement("div");
  const nameDisplay = document.createElement("span");
  nameDisplay.className = "name-display";
  nameDisplay.textContent = block.name;
  const nameInput = document.createElement("input");
  nameInput.className = "inline-input hidden";
  nameInput.type = "text";
  nameInput.value = block.name;
  function saveName() {
    block.name = nameInput.value.trim() || (block.type === "break" ? "break" : "exercise");
    renderBlockList();
  }
  nameDisplay.addEventListener("click", () => {
    nameDisplay.classList.add("hidden");
    nameInput.classList.remove("hidden");
    nameInput.focus();
    nameInput.select();
  });
  nameInput.addEventListener("blur", saveName);
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveName();
  });
  wrapper.append(nameDisplay, nameInput);
  return wrapper;
}

function createTimeEditable(block) {
  const wrapper = document.createElement("div");
  const timeDisplay = document.createElement("span");
  timeDisplay.className = "time-display";
  const durationParts = toMMSSParts(block.durationSeconds);
  timeDisplay.textContent = `${durationParts.minutes}:${durationParts.seconds}`;
  const timeInput = document.createElement("input");
  timeInput.className = "inline-input inline-time hidden";
  timeInput.type = "text";
  timeInput.inputMode = "numeric";
  timeInput.placeholder = "mm:ss";
  timeInput.value = formatSecondsToDurationInput(block.durationSeconds);
  function saveTime() {
    const seconds = parseDurationInputToSeconds(timeInput.value);
    block.durationSeconds = Math.max(1, Number.isNaN(seconds) ? 60 : seconds);
    renderBlockList();
  }
  timeDisplay.addEventListener("click", () => {
    timeDisplay.classList.add("hidden");
    timeInput.classList.remove("hidden");
    timeInput.focus();
    timeInput.select();
  });
  timeInput.addEventListener("blur", saveTime);
  timeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveTime();
  });
  wrapper.append(timeDisplay, timeInput);
  return wrapper;
}

function removeBlock(blockId) {
  appState.blocks = appState.blocks.filter((block) => block.id !== blockId);
  appState.blocks.forEach((block) => {
    if (block.type === "repeat" && block.fromBlockId === blockId) {
      block.fromBlockId = null;
    }
  });
  if (appState.selectingRepeatBlockId === blockId) {
    appState.selectingRepeatBlockId = null;
  }
  renderBlockList();
}

function playAudioClip(audioKey) {
  const clip = appState.audio[audioKey];
  if (!clip) return;
  try {
    clip.currentTime = 0;
    const maybePromise = clip.play();
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => {});
    }
  } catch {
    // Ignore playback failures (missing file, autoplay restrictions, etc.).
  }
}

function validateRepeatReferences() {
  appState.blocks.forEach((block, index) => {
    if (block.type !== "repeat" || !block.fromBlockId) return;
    const fromIndex = appState.blocks.findIndex((item) => item.id === block.fromBlockId);
    if (fromIndex < 0 || fromIndex >= index) {
      block.fromBlockId = null;
    }
  });
}

function moveBlock(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= appState.blocks.length) return;
  const [moved] = appState.blocks.splice(fromIndex, 1);
  appState.blocks.splice(toIndex, 0, moved);
  validateRepeatReferences();
  renderBlockList();
}

function createMoveControls(index) {
  if (!appState.isEditMode) return null;
  const controls = document.createElement("div");
  controls.className = "move-controls";

  const upButton = document.createElement("button");
  upButton.type = "button";
  upButton.className = "move-btn";
  upButton.textContent = "▲";
  upButton.addEventListener("click", (event) => {
    event.stopPropagation();
    moveBlock(index, index - 1);
  });

  const downButton = document.createElement("button");
  downButton.type = "button";
  downButton.className = "move-btn";
  downButton.textContent = "▼";
  downButton.addEventListener("click", (event) => {
    event.stopPropagation();
    moveBlock(index, index + 1);
  });

  controls.append(upButton, downButton);
  return controls;
}

function createRepeatRow(block, index) {
  const row = document.createElement("li");
  row.className = "block-row is-repeat";
  row.dataset.blockIndex = String(index);
  row.dataset.blockId = block.id;

  const icon = document.createElement("div");
  icon.className = "repeat-icon";
  icon.textContent = "⟲";

  const center = document.createElement("div");
  center.className = "repeat-center";
  const chooseFromButton = document.createElement("button");
  chooseFromButton.type = "button";
  chooseFromButton.className = "choose-from-btn";
  chooseFromButton.textContent = "choose from when";
  chooseFromButton.addEventListener("click", () => {
    appState.selectingRepeatBlockId = block.id;
    renderBlockList();
  });
  center.appendChild(chooseFromButton);

  if (block.fromBlockId) {
    const fromBlock = appState.blocks.find((item) => item.id === block.fromBlockId && item.type !== "repeat");
    if (fromBlock) {
      const text = document.createElement("span");
      text.className = "repeat-from-text";
      text.textContent = `repeats from ${fromBlock.name}`;
      text.style.color = isTimedBlockType(fromBlock.type) ? fromBlock.color : "#d0d0d0";
      center.appendChild(text);
    }
  }

  const repeatCountInput = document.createElement("input");
  repeatCountInput.className = "inline-input repeat-count-input";
  repeatCountInput.type = "number";
  repeatCountInput.min = "2";
  repeatCountInput.value = String(block.repeatCount);
  repeatCountInput.addEventListener("change", () => {
    const value = Number.parseInt(repeatCountInput.value, 10);
    block.repeatCount = Number.isNaN(value) ? 2 : Math.max(2, value);
    renderBlockList();
  });

  row.append(icon, center, repeatCountInput);

  const moveControls = createMoveControls(index);
  if (moveControls) {
    row.append(moveControls);
  }

  if (appState.isEditMode) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "🗑";
    deleteButton.addEventListener("click", () => removeBlock(block.id));
    row.append(deleteButton);
  }
  return row;
}

function renderBlockList() {
  closeAnyColorPicker();
  blockListEl.innerHTML = "";

  appState.blocks.forEach((block, index) => {
    if (block.type === "repeat") {
      const repeatRow = createRepeatRow(block, index);
      blockListEl.appendChild(repeatRow);
      return;
    }

    const row = document.createElement("li");
    row.className = "block-row";
    row.dataset.blockIndex = String(index);
    row.dataset.blockId = block.id;

    const isSelectableTarget =
      appState.selectingRepeatBlockId &&
      index < appState.blocks.findIndex((item) => item.id === appState.selectingRepeatBlockId) &&
      block.type !== "repeat";
    if (isSelectableTarget) {
      row.classList.add("is-selectable-target");
      row.addEventListener("click", () => {
        const repeatBlock = appState.blocks.find((item) => item.id === appState.selectingRepeatBlockId);
        if (!repeatBlock || repeatBlock.type !== "repeat") return;
        repeatBlock.fromBlockId = block.id;
        appState.selectingRepeatBlockId = null;
        renderBlockList();
      });
    }

    if (block.type === "continue") {
      const continueIcon = document.createElement("div");
      continueIcon.className = "repeat-icon";
      continueIcon.textContent = "⏯";
      const continueName = document.createElement("span");
      continueName.className = "name-display";
      continueName.textContent = "Press to Continue";
      const continueHint = document.createElement("span");
      continueHint.className = "time-display";
      continueHint.style.color = "#aaaaaa";
      continueHint.textContent = "manual";
      row.classList.add("is-repeat");
      row.append(continueIcon, continueName, continueHint);
    } else {
      const colorSquare = document.createElement("button");
      colorSquare.type = "button";
      colorSquare.className = "color-square";
      colorSquare.style.backgroundColor = block.color;
      colorSquare.addEventListener("click", (event) => {
        event.stopPropagation();
        openColorPicker(colorSquare, block.id);
      });
      const nameEditable = createNameEditable(block);
      const timeEditable = createTimeEditable(block);
      row.append(colorSquare, nameEditable, timeEditable);
    }

    const moveControls = createMoveControls(index);
    if (moveControls) {
      row.append(moveControls);
    }

    if (appState.isEditMode) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-btn";
      deleteButton.textContent = "🗑";
      deleteButton.addEventListener("click", () => removeBlock(block.id));
      row.append(deleteButton);
    }
    blockListEl.appendChild(row);
  });
}

function addExerciseIntervalBlock() {
  appState.blocks.push({
    id: crypto.randomUUID(),
    type: "exercise",
    name: "exercise",
    durationSeconds: 60,
    color: "#ff1a1a",
  });
  renderBlockList();
}

function addBreakIntervalBlock() {
  appState.blocks.push({
    id: crypto.randomUUID(),
    type: "break",
    name: "break",
    durationSeconds: 30,
    color: "#2f81f7",
  });
  renderBlockList();
}

function addRepeatBlock() {
  appState.blocks.push({
    id: crypto.randomUUID(),
    type: "repeat",
    fromBlockId: null,
    repeatCount: 2,
  });
  renderBlockList();
}

function addPressToContinueBlock() {
  appState.blocks.push({
    id: crypto.randomUUID(),
    type: "continue",
    name: "finished",
  });
  renderBlockList();
}

function openAddMenu() {
  if (appState.addMenuOpen) {
    closeAddMenu();
    return;
  }
  closeAnyColorPicker();
  const menu = document.createElement("div");
  menu.className = "add-menu";

  const addIntervalButton = document.createElement("button");
  addIntervalButton.type = "button";
  addIntervalButton.textContent = "Exercise Interval";
  addIntervalButton.addEventListener("click", () => {
    addExerciseIntervalBlock();
    closeAddMenu();
  });

  const addBreakButton = document.createElement("button");
  addBreakButton.type = "button";
  addBreakButton.textContent = "Break Interval";
  addBreakButton.addEventListener("click", () => {
    addBreakIntervalBlock();
    closeAddMenu();
  });

  const addRepeatButton = document.createElement("button");
  addRepeatButton.type = "button";
  addRepeatButton.textContent = "Repeat";
  addRepeatButton.addEventListener("click", () => {
    addRepeatBlock();
    closeAddMenu();
  });

  const addContinueButton = document.createElement("button");
  addContinueButton.type = "button";
  addContinueButton.textContent = "Press to Continue";
  addContinueButton.addEventListener("click", () => {
    addPressToContinueBlock();
    closeAddMenu();
  });

  menu.append(addIntervalButton, addBreakButton, addRepeatButton, addContinueButton);
  const box = addBlockButtonEl.getBoundingClientRect();
  menu.style.top = `${box.bottom + 8}px`;
  menu.style.left = `${box.left}px`;
  document.body.appendChild(menu);
  appState.addMenuOpen = true;
}

function buildExecutionPlan() {
  const plan = appState.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type !== "repeat")
    .map(({ block, index }) => {
      if (isTimedBlockType(block.type)) {
        return {
          stepType: "interval",
          blockId: block.id,
          sourceIndex: index,
          name: block.name,
          durationSeconds: block.durationSeconds,
          color: block.color,
          roundCurrent: 1,
          roundTotal: 1,
          intervalKind: block.type,
        };
      }
      return {
        stepType: "continue",
        blockId: block.id,
        sourceIndex: index,
        name: "finished",
        durationSeconds: 0,
        color: "#ffffff",
        roundCurrent: 1,
        roundTotal: 1,
      };
    });

  appState.blocks.forEach((block, repeatIndex) => {
    if (block.type !== "repeat" || !block.fromBlockId) return;
    const fromIndex = appState.blocks.findIndex((item) => item.id === block.fromBlockId);
    if (fromIndex < 0 || fromIndex >= repeatIndex) return;

    const segment = plan.filter((step) => step.sourceIndex >= fromIndex && step.sourceIndex < repeatIndex);
    if (segment.length === 0) return;

    const firstSegmentIndex = plan.findIndex((step) => step.sourceIndex === segment[0].sourceIndex);
    const lastSegmentIndex = plan.findIndex((step) => step.sourceIndex === segment[segment.length - 1].sourceIndex);
    if (firstSegmentIndex < 0 || lastSegmentIndex < firstSegmentIndex) return;

    const before = plan.slice(0, firstSegmentIndex);
    const after = plan.slice(lastSegmentIndex + 1);
    const repeated = [];

    for (let round = 1; round <= block.repeatCount; round += 1) {
      segment.forEach((item) => {
        repeated.push({
          ...item,
          roundCurrent: round,
          roundTotal: block.repeatCount,
        });
      });
    }
    plan.splice(0, plan.length, ...before, ...repeated, ...after);
  });

  return plan;
}

function clearTimerPlayback() {
  if (appState.activeTimerId) {
    clearInterval(appState.activeTimerId);
    appState.activeTimerId = null;
  }
}

function setCountdownDisplay(totalSeconds) {
  const parts = toMMSSParts(Math.max(0, totalSeconds));
  timerMinutesEl.textContent = parts.minutes;
  timerSecondsEl.textContent = parts.seconds;
}

function showTimerControlsTemporarily() {
  timerControlsEl.classList.remove("is-hidden");
  if (appState.hideControlsTimeoutId) {
    clearTimeout(appState.hideControlsTimeoutId);
  }
  appState.hideControlsTimeoutId = setTimeout(() => {
    timerControlsEl.classList.add("is-hidden");
  }, 3000);
}

function renderTimerState() {
  if (!appState.playback || appState.playback.currentStep >= appState.playback.plan.length) {
    timerBlockNameEl.textContent = "Finished";
    timerBlockNameEl.style.color = "#ffffff";
    timerRoundCounterEl.textContent = "0/0";
    setCountdownDisplay(0);
    timerMinutesEl.style.color = "#ffffff";
    timerSecondsEl.style.color = "#ffffff";
    timerColonEl.style.color = "#ffffff";
    continueButtonEl.classList.add("hidden");
    return;
  }

  const current = appState.playback.plan[appState.playback.currentStep];
  timerRoundCounterEl.textContent = `${current.roundCurrent}/${current.roundTotal}`;

  if (current.stepType === "continue") {
    timerBlockNameEl.textContent = "finished";
    timerBlockNameEl.style.color = "#ffffff";
    setCountdownDisplay(0);
    timerMinutesEl.style.color = "#ffffff";
    timerSecondsEl.style.color = "#ffffff";
    timerColonEl.style.color = "#ffffff";
    continueButtonEl.classList.remove("hidden");
    return;
  }

  timerBlockNameEl.textContent = current.name;
  timerBlockNameEl.style.color = current.color;
  setCountdownDisplay(appState.playback.remainingSeconds);
  timerMinutesEl.style.color = current.color;
  timerSecondsEl.style.color = current.color;
  timerColonEl.style.color = current.color;
  continueButtonEl.classList.add("hidden");
}

function moveToNextPlaybackStep() {
  appState.playback.currentStep += 1;
  if (appState.playback.currentStep >= appState.playback.plan.length) {
    clearTimerPlayback();
    renderTimerState();
    return false;
  }

  const nextStep = appState.playback.plan[appState.playback.currentStep];
  if (nextStep.stepType === "continue") {
    appState.playback.remainingSeconds = 0;
    playAudioClip("start");
    clearTimerPlayback();
    renderTimerState();
    return false;
  }

  appState.playback.remainingSeconds = nextStep.durationSeconds;
  appState.playback.warningPlayed = false;
  playAudioClip("start");
  renderTimerState();
  return true;
}

function startIntervalTicker() {
  clearTimerPlayback();
  appState.activeTimerId = setInterval(() => {
    if (!appState.playback) return;
    appState.playback.remainingSeconds -= 1;

    if (
      !appState.playback.warningPlayed &&
      appState.playback.remainingSeconds === 10 &&
      appState.playback.plan[appState.playback.currentStep].durationSeconds > 10
    ) {
      playAudioClip("warning10s");
      appState.playback.warningPlayed = true;
    }

    if (appState.playback.remainingSeconds <= 0) {
      moveToNextPlaybackStep();
      return;
    }

    renderTimerState();
  }, 1000);
}

function playBlocksSequentially() {
  clearTimerPlayback();
  const plan = buildExecutionPlan();

  if (plan.length === 0) {
    timerBlockNameEl.textContent = "No Intervals";
    timerBlockNameEl.style.color = "#ffffff";
    timerRoundCounterEl.textContent = "0/0";
    setCountdownDisplay(0);
    timerMinutesEl.style.color = "#ffffff";
    timerSecondsEl.style.color = "#ffffff";
    timerColonEl.style.color = "#ffffff";
    continueButtonEl.classList.add("hidden");
    return;
  }

  appState.playback = {
    plan,
    currentStep: 0,
    remainingSeconds: plan[0].stepType === "interval" ? plan[0].durationSeconds : 0,
    warningPlayed: false,
  };
  renderTimerState();

  if (plan[0].stepType === "continue") {
    playAudioClip("start");
    return;
  }

  playAudioClip("start");
  startIntervalTicker();
}

function continuePlaybackAfterManualStep() {
  if (!appState.playback) return;
  const current = appState.playback.plan[appState.playback.currentStep];
  if (!current || current.stepType !== "continue") return;

  appState.playback.currentStep += 1;
  if (appState.playback.currentStep >= appState.playback.plan.length) {
    renderTimerState();
    return;
  }

  const nextStep = appState.playback.plan[appState.playback.currentStep];
  appState.playback.remainingSeconds = nextStep.stepType === "interval" ? nextStep.durationSeconds : 0;
  appState.playback.warningPlayed = false;
  renderTimerState();

  playAudioClip("start");
  if (nextStep.stepType === "continue") return;
  startIntervalTicker();
}

function showScreen(screenName) {
  const showSetup = screenName === "setup";
  setupScreenEl.classList.toggle("hidden", !showSetup);
  timerScreenEl.classList.toggle("hidden", showSetup);
  closeAnyColorPicker();
  closeAddMenu();
  if (showSetup) {
    clearTimerPlayback();
    appState.playback = null;
    timerControlsEl.classList.remove("is-hidden");
    if (appState.hideControlsTimeoutId) {
      clearTimeout(appState.hideControlsTimeoutId);
      appState.hideControlsTimeoutId = null;
    }
    continueButtonEl.classList.add("hidden");
  } else {
    continueButtonEl.classList.add("hidden");
    showTimerControlsTemporarily();
  }
}

addBlockButtonEl.addEventListener("click", openAddMenu);
editBlocksButtonEl.addEventListener("click", () => {
  appState.isEditMode = !appState.isEditMode;
  editBlocksButtonEl.classList.toggle("is-active", appState.isEditMode);
  renderBlockList();
});
playButtonEl.addEventListener("click", () => {
  showScreen("timer");
  playBlocksSequentially();
});
backToSetupButtonEl.addEventListener("click", () => showScreen("setup"));
continueButtonEl.addEventListener("click", continuePlaybackAfterManualStep);
fullscreenButtonEl.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    // Browser can reject fullscreen if not allowed.
  }
});
timerScreenEl.addEventListener("mousemove", showTimerControlsTemporarily);
timerScreenEl.addEventListener("touchstart", showTimerControlsTemporarily, { passive: true });

document.addEventListener("click", (event) => {
  const clickedPicker = event.target.closest(".basic-color-picker");
  const clickedSquare = event.target.closest(".color-square");
  const clickedAddButton = event.target.closest("#addBlockButton");
  const clickedAddMenu = event.target.closest(".add-menu");
  if (!clickedPicker && !clickedSquare) closeAnyColorPicker();
  if (!clickedAddButton && !clickedAddMenu) closeAddMenu();
});

showScreen("setup");
renderBlockList();
initializeAdsenseUnits();
window.addEventListener("load", initializeAdsenseUnits);
setTimeout(initializeAdsenseUnits, 1500);
