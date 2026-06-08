const cards = [
  { name: "毛毛蟲", score: 1, image: "assets/01_毛毛蟲_去背.png" },
  { name: "蝴蝶", score: 1, image: "assets/02_蝴蝶_去背.png" },
  { name: "蜘蛛", score: 2, image: "assets/03_蜘蛛_去背.png" },
  { name: "蟑螂", score: 2, image: "assets/04_蟑螂_去背.png" },
  { name: "糞金龜", score: 3, image: "assets/05_糞金龜_去背.png" },
  { name: "蜈蚣", score: 3, image: "assets/06_蜈蚣_去背.png" },
  { name: "螞蟻", score: 2, image: "assets/07_螞蟻_去背.png" },
  { name: "蒼蠅", score: 1, image: "assets/08_蒼蠅_去背.png" },
];

const avatarList = [
  "avatars/male_explorer.png", "avatars/male_scout.png", "avatars/male_black_glasses.png",
  "avatars/male_cap.png", "avatars/male_curly.png", "avatars/male_red_glasses.png",
  "avatars/female_net_hat.png", "avatars/female_buns.png", "avatars/female_butterfly_hat.png",
  "avatars/female_flower_ponytail.png", "avatars/female_purple_bow.png", "avatars/female_red_beret.png",
];
const maxRounds = 8;

const el = Object.fromEntries([
  "setupScreen", "gameScreen", "setupForm", "nameFields", "playersRing", "roundNumber",
  "describerName", "guesserName", "phaseHint", "revealedCard", "cardImage",
  "cardName", "claimText", "currentHand", "scoreList", "rulesBtn", "resetBtn", "rulesDialog",
].map((id) => [id, document.getElementById(id)]));

let game = null;

function selectedPlayerCount() {
  return Number(new FormData(el.setupForm).get("playerCount") || 4);
}

// 共用頭像選取狀態
let pickerState = { active: null, assigned: {} }; // assigned: { avatarSrc: playerIndex }

function getPlayerAvatar(playerIndex) {
  return Object.keys(pickerState.assigned).find(
    src => pickerState.assigned[src] === playerIndex
  ) || null;
}

function renderNameFields() {
  const count = selectedPlayerCount();
  pickerState = { active: null, assigned: {} };
  el.nameFields.replaceChildren();

  // 玩家列
  const playersWrap = document.createElement("div");
  playersWrap.className = "picker-players";
  playersWrap.id = "pickerPlayers";

  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.className = "picker-player-row";
    row.dataset.index = i;
    row.innerHTML = `
      <div class="picker-avatar-slot" data-index="${i}">?</div>
      <label class="name-field">
        <span>玩家 ${i + 1}</span>
        <input name="playerName" maxlength="10" value="玩家 ${i + 1}" required>
      </label>
      <input type="hidden" name="avatar_${i}" value="">
    `;
    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      pickerState.active = i;
      renderPickerHighlight();
    });
    playersWrap.append(row);
  }

  // 共用頭像池
  const pool = document.createElement("div");
  pool.className = "avatar-pool";
  pool.id = "avatarPool";
  avatarList.forEach((src) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-pool-btn";
    btn.dataset.src = src;
    btn.innerHTML = `<img src="${src}" alt=""><span class="pool-badge"></span>`;
    btn.addEventListener("click", () => onAvatarPoolClick(src));
    pool.append(btn);
  });

  el.nameFields.append(playersWrap);
  el.nameFields.append(pool);
  renderPickerHighlight();
}

function renderPickerHighlight() {
  const count = selectedPlayerCount();
  // 玩家列高亮
  document.querySelectorAll(".picker-player-row").forEach(row => {
    const i = Number(row.dataset.index);
    row.classList.toggle("picker-active", i === pickerState.active);
    // 更新頭像欄
    const slot = row.querySelector(".picker-avatar-slot");
    const src = getPlayerAvatar(i);
    if (src) {
      slot.innerHTML = `<img src="${src}" alt="">`;
    } else {
      slot.textContent = "?";
    }
    // 同步 hidden input
    row.querySelector(`input[name="avatar_${i}"]`).value = src || "";
  });

  // 頭像池狀態
  document.querySelectorAll(".avatar-pool-btn").forEach(btn => {
    const src = btn.dataset.src;
    const owner = pickerState.assigned[src] ?? null;
    btn.classList.toggle("pool-taken", owner !== null);
    btn.classList.toggle("pool-available", owner === null && pickerState.active !== null);
    const badge = btn.querySelector(".pool-badge");
    badge.textContent = owner !== null ? `P${owner + 1}` : "";
  });
}

function onAvatarPoolClick(src) {
  if (pickerState.active === null) return;
  const playerIdx = pickerState.active;

  // 若此玩家已有頭像，先釋放
  const oldSrc = getPlayerAvatar(playerIdx);
  if (oldSrc) delete pickerState.assigned[oldSrc];

  // 若該頭像已被別人選，退回
  if (pickerState.assigned[src] !== undefined) {
    // 取消別人的選取
    delete pickerState.assigned[src];
  } else {
    pickerState.assigned[src] = playerIdx;
    // 自動移到下一個沒有頭像的玩家
    const count = selectedPlayerCount();
    const next = Array.from({ length: count }, (_, i) => (playerIdx + 1 + i) % count)
      .find(i => !getPlayerAvatar(i));
    pickerState.active = next ?? null;
  }
  renderPickerHighlight();
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function buildDeck() {
  return shuffle(Array.from({ length: 4 }, () => cards).flat());
}

function startGame(names) {
  const fd = new FormData(el.setupForm);
  game = {
    players: names.map((name, index) => ({
      id: index,
      name,
      avatar: fd.get(`avatar_${index}`) || avatarList[index % avatarList.length],
      hand: [],
    })),
    deck: buildDeck(),
    round: 1,
    phase: "draw",
    describer: 0,
    guesser: 1,
    drawnCard: null,
    claim: null,
    lie: false,
    message: "描述者請抽牌。",
    eventLog: [],
  };
  el.setupScreen.classList.add("hidden");
  el.gameScreen.classList.remove("hidden");
  render();
}

function scoreOf(player) {
  return player.hand.reduce((sum, card) => sum + card.score, 0);
}

function nextTurn() {
  game.round += 1;
  if (game.round > maxRounds || game.deck.length === 0) {
    game.phase = "finished";
    game.message = "遊戲結束，總點數最少者獲勝。";
    render();
    return;
  }
  game.describer = (game.describer + 1) % game.players.length;
  game.guesser = (game.describer + 1) % game.players.length;
  game.drawnCard = null;
  game.claim = null;
  game.lie = false;
  game.phase = "draw";
  game.message = "描述者請抽牌。";
  render();
}

function drawCard() {
  if (game.phase !== "draw") return;
  game.drawnCard = game.deck.pop();
  game.claim = null;
  game.phase = "claim";
  game.message = `${game.players[game.describer].name} 已抽牌，請選擇誠實或說謊。`;
  render();
}

function makeClaim(isLie) {
  if (game.phase !== "claim") return;
  game.lie = isLie;
  if (isLie) {
    const choices = cards.filter((card) => card.name !== game.drawnCard.name);
    game.claim = choices[Math.floor(Math.random() * choices.length)];
  } else {
    game.claim = game.drawnCard;
  }
  game.phase = "guess";
  game.message = `${game.players[game.guesser].name} 請判斷這張牌是不是「${game.claim.name}」。`;
  render();
}

function resolveGuess(believe) {
  if (game.phase !== "guess") return;
  const isTruth = !game.lie;
  const guessCorrect = believe === isTruth;
  const receiverIndex = guessCorrect ? game.describer : game.guesser;
  const describerName = game.players[game.describer].name;
  const guesserName = game.players[game.guesser].name;
  const receiver = game.players[receiverIndex];
  game.players[receiverIndex].hand.push(game.drawnCard);

  // 產生事件說明
  const truthLabel = isTruth ? "誠實說明" : "謊稱";
  const believeLabel = believe ? "選擇相信" : "選擇不相信";
  let reason;
  if (isTruth && believe)   reason = `${guesserName}判斷正確，牌歸${describerName}`;
  if (isTruth && !believe)  reason = `${guesserName}判斷錯誤，牌歸${guesserName}`;
  if (!isTruth && believe)  reason = `${guesserName}判斷錯誤，牌歸${guesserName}`;
  if (!isTruth && !believe) reason = `${guesserName}判斷正確，牌歸${describerName}`;

  game.eventLog.unshift({
    round: game.round,
    card: game.drawnCard.name,
    score: game.drawnCard.score,
    text: `${describerName}${truthLabel}了「${game.claim.name}」，${guesserName}${believeLabel}。${reason}。`,
    receiver: receiver.name,
    correct: guessCorrect,
  });

  game.message = guessCorrect
    ? `猜測正確，${receiver.name} 收下 ${game.drawnCard.name}。`
    : `猜測錯誤，${receiver.name} 收下 ${game.drawnCard.name}。`;
  game.phase = "result";
  render();
  window.setTimeout(nextTurn, 1600);
}

function runAction(action) {
  if (action === "draw") drawCard();
  if (action === "truth") makeClaim(false);
  if (action === "lie") makeClaim(true);
  if (action === "believe") resolveGuess(true);
  if (action === "doubt") resolveGuess(false);
}

function renderEventLog() {
  const container = document.getElementById("eventLog");
  if (!container) return;
  if (!game.eventLog.length) {
    container.innerHTML = '<p class="event-empty">回合結束後會顯示事件說明</p>';
    return;
  }
  container.replaceChildren();
  game.eventLog.slice(0, 6).forEach((evt) => {
    const item = document.createElement("div");
    item.className = `event-item ${evt.correct ? "event-correct" : "event-wrong"}`;
    item.innerHTML = `
      <span class="event-round">第${evt.round}回</span>
      <span class="event-text">${evt.text}</span>
      <span class="event-card">${evt.card} +${evt.score}分</span>
    `;
    container.append(item);
  });
}

function render() {
  renderPlayers();
  renderCenter();
  renderHand();
  renderScores();
  renderEventLog();
}

function playerActions(index) {
  const isDescriber = index === game.describer;
  const isGuesser = index === game.guesser;
  if (game.phase === "finished") return "";

  if (isDescriber) {
    return `
      <div class="seat-actions describer-actions" aria-label="描述者行動">
        <button class="seat-action draw" type="button" data-action="draw" ${game.phase === "draw" ? "" : "disabled"}>抽牌</button>
        <button class="seat-action truth" type="button" data-action="truth" ${game.phase === "claim" ? "" : "disabled"}>誠實</button>
        <button class="seat-action lie" type="button" data-action="lie" ${game.phase === "claim" ? "" : "disabled"}>說謊</button>
      </div>
    `;
  }

  if (isGuesser) {
    return `
      <div class="seat-actions guesser-actions" aria-label="猜測者行動">
        <button class="seat-action believe" type="button" data-action="believe" ${game.phase === "guess" ? "" : "disabled"}>相信</button>
        <button class="seat-action doubt" type="button" data-action="doubt" ${game.phase === "guess" ? "" : "disabled"}>不相信</button>
      </div>
    `;
  }

  return "";
}

function renderPlayers() {
  el.playersRing.replaceChildren();
  game.players.forEach((player, index) => {
    const isDescriber = index === game.describer;
    const isGuesser   = index === game.guesser;
    const card = document.createElement("article");
    card.className = "player-card";
    if (isDescriber) card.classList.add("active");
    if (isGuesser && game.phase === "guess") card.classList.add("guessing");

    const statusBadge = isDescriber
      ? `<span class="status-badge is-describer">描述者</span>`
      : isGuesser
        ? `<span class="status-badge is-guesser">猜測者</span>`
        : "";

    card.innerHTML = `
      <div class="player-card-header">
        <img class="avatar-img" src="${player.avatar}" alt="${player.name}">
        <div class="player-info">
          <strong>${player.name}</strong>
          <span>${statusBadge} ${scoreOf(player)} 分</span>
        </div>
        <div class="mini-hand">${player.hand.length}</div>
      </div>
      ${playerActions(index)}
    `;
    el.playersRing.append(card);
  });
}

function renderCenter() {
  const describer = game.players[game.describer];
  const guesser = game.players[game.guesser];
  el.roundNumber.textContent = Math.min(game.round, maxRounds);
  const deckLabel = document.getElementById("deckLabel");
  if (deckLabel) deckLabel.textContent = `牌庫（剩餘 ${game.deck.length} 張）`;
  const dR = document.getElementById("describerNameR");
  const gR = document.getElementById("guesserNameR");
  const hR = document.getElementById("phaseHintR");
  if (dR) dR.textContent = describer.name;
  if (gR) gR.textContent = guesser.name;
  if (hR) hR.textContent = game.message;
  el.describerName.textContent = describer.name;
  el.guesserName.textContent = guesser.name;
  el.phaseHint.textContent = game.message;
  el.claimText.textContent = game.claim ? `宣稱：${game.claim.name}` : "尚未宣稱昆蟲";

  const showFront = game.phase === "claim" || game.phase === "result" || game.phase === "finished";
  el.revealedCard.classList.toggle("card-back", !showFront);
  if (showFront && game.drawnCard) {
    el.cardImage.src = game.drawnCard.image;
    el.cardImage.alt = game.drawnCard.name;
    el.cardName.textContent = game.drawnCard.name;
  } else {
    el.cardImage.removeAttribute("alt");
    el.cardName.textContent = "昆蟲牌";
  }
}

function renderHandFor(container, playerIndex) {
  if (!container) return;
  const player = game.players[playerIndex];
  container.replaceChildren();
  const cardsToShow = player.hand.length ? player.hand : [{ name: "尚無手牌", score: 0, image: "" }];
  cardsToShow.forEach((card) => {
    const item = document.createElement("div");
    item.className = "hand-card";
    item.innerHTML = card.image
      ? `<span>${card.score}</span><img src="${card.image}" alt=""><strong>${card.name}</strong>`
      : `<strong>${card.name}</strong>`;
    container.append(item);
  });
}

function renderHand() {
  renderHandFor(el.currentHand, game.describer);
  renderHandFor(document.getElementById("guesserHand"), game.guesser);
}

function renderScores() {
  const sorted = [...game.players].sort((a, b) => scoreOf(a) - scoreOf(b));
  el.scoreList.replaceChildren();
  sorted.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = index === 0 ? "score-row leading" : "score-row";
    row.innerHTML = `<span>${player.name}</span><strong>${scoreOf(player)} 分</strong>`;
    el.scoreList.append(row);
  });
}

el.setupForm.addEventListener("change", (event) => {
  if (event.target.name === "playerCount") renderNameFields();
});

el.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const names = [...new FormData(el.setupForm).getAll("playerName")]
    .map((name, index) => String(name).trim() || `玩家 ${index + 1}`);
  startGame(names);
});

el.playersRing.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  runAction(button.dataset.action);
});

el.resetBtn.addEventListener("click", () => {
  game = null;
  el.gameScreen.classList.add("hidden");
  el.setupScreen.classList.remove("hidden");
});
el.rulesBtn.addEventListener("click", () => el.rulesDialog.showModal());

// ── 聊天室 ──
function nowTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function addChatMsg(name, text) {
  const box = document.getElementById("chatMessages");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "chat-msg";
  div.innerHTML = `
    <div class="chat-msg-header">
      <span class="chat-msg-name">${name}</span>
      <span class="chat-msg-time">${nowTime()}</span>
    </div>
    <div class="chat-msg-text">${text}</div>
  `;
  box.append(div);
  box.scrollTop = box.scrollHeight;
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  const senderName = game ? game.players[game.describer]?.name ?? "玩家" : "玩家";
  addChatMsg(senderName, text);
  input.value = "";
}

document.getElementById("chatSend")?.addEventListener("click", sendChat);
document.getElementById("chatInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") sendChat();
});

renderNameFields();
