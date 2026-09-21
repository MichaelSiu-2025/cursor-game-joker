// ==========================================
// 1. 全域狀態初始化 (Game State)
// ==========================================
let totalBalance = 50000;        // 玩家初始總資產變成 $5000
let selectedChipValue = 100;     // 預設選中的籌碼面額改為 $100
let jackpotPoolAmount = 25480;  // <-- 全新加入：用來動態紀錄累進彩池的真實金額

// 記錄 5 個投注區的目前下注金額
let bets = {
    jackpot: 0,
    pairplus: 0,
    ante: 0,
    play: 0,
    sixcard: 0
};

// 遊戲階段控制：'betting' (下注中), 'dealt' (已發牌，抉擇中), 'resolved' (已結算)
let gameState = 'betting'; 

// ==========================================
// 2. DOM 元素獲取 (UI Elements)
// ==========================================
const elTotalBalance = document.getElementById('total-balance');
const elGameMessage = document.getElementById('game-message');

const elChips = {
    jackpot: document.getElementById('chip-jackpot'),
    pairplus: document.getElementById('chip-pairplus'),
    ante: document.getElementById('chip-ante'),
    play: document.getElementById('chip-play'),
    sixcard: document.getElementById('chip-sixcard')
};

const elZones = {
    jackpot: document.getElementById('zone-jackpot'),
    pairplus: document.getElementById('zone-pairplus'),
    ante: document.getElementById('zone-ante'),
    play: document.getElementById('zone-play'),
    sixcard: document.getElementById('zone-sixcard')
};

const elBtnClear = document.getElementById('btn-clear');
const elBtnDeal = document.getElementById('btn-deal');
const elBtnFold = document.getElementById('btn-fold');
const elBtnPlay = document.getElementById('btn-play');
const elBtnNext = document.getElementById('btn-next'); // <-- 追加這一行


// ==========================================
// 3. 籌碼切換與下注邏輯
// ==========================================

/**
 * 改變目前選中的籌碼面額
 * @param {number} value - 籌碼數值
 */
function selectChip(value) {
    // 修正：除了下注階段（betting），在已結算等待下一局的階段（resolved）同樣允許換籌碼！
    if (gameState !== 'betting' && gameState !== 'resolved') return; 

    selectedChipValue = value;
    
    // 移除所有籌碼按鈕的 active 樣式
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove('active-chip');
    });
    
    // 為當前點擊的籌碼按鈕加上高亮
    const activeChipBtn = document.querySelector(`.chip-${value}`);
    if (activeChipBtn) {
        activeChipBtn.classList.add('active-chip');
    }
}


/**
 * 處理下注點擊事件
 * @param {string} zoneName - 投注區名稱 (jackpot, pairplus, ante, play, sixcard)
 */
function placeBet(zoneName) {
    // 【全新加入】如果上局剛結算完，玩家直接點擊下注，自動執行蓋牌重置
    if (gameState === 'resolved') {
        resetCardsToBack();
    }

    // 1. 只有喺下注階段才可以下注
    if (gameState !== 'betting') return;

    // 2. PLAY 圈不能直接手動下注，必須等發牌後點擊「加注」按鈕
    if (zoneName === 'play') {
        updateMessage("💡 PLAY 圈不能直接下注，請先買 ANTE 並點擊發牌。");
        return;
    }

    // 3. 檢查餘額是否足夠
    if (totalBalance < selectedChipValue) {
        updateMessage("❌ 餘額不足，不夠放入該面額的籌碼！");
        return;
    }

    // 4. 扣錢並增加該區注碼
    totalBalance -= selectedChipValue;
    bets[zoneName] += selectedChipValue;

    // 5. 更新 UI
    updateUI();
}

/**
 * 清空所有已下的注碼，退回給玩家
 */
function clearAllBets() {
    if (gameState !== 'betting') return;

    // 將所有注碼加回總資產
    const totalReturned = bets.jackpot + bets.pairplus + bets.ante + bets.play + bets.sixcard;
    totalBalance += totalReturned;

    // 歸零注碼
    bets.jackpot = 0;
    bets.pairplus = 0;
    bets.ante = 0;
    bets.play = 0;
    bets.sixcard = 0;

    updateMessage("請放入本注（Ante）開始遊戲");
    updateUI();
}

// ==========================================
// 4. UI 畫面渲染更新
// ==========================================

function updateUI() {

    // 更新畫面上的 Jackpot 實時彩池數字
    const elPool = document.querySelector('.jackpot-pool');
    if (elPool) elPool.textContent = `$${jackpotPoolAmount.toLocaleString()}`;

    // 更新總資產顯示
    elTotalBalance.textContent = totalBalance;

    // 更新 5 個投注圈的籌碼數字與樣式
    for (let zone in bets) {
        const chipAmount = bets[zone];
        const elChip = elChips[zone];
        const elZone = elZones[zone];

        if (elChip) {
            elChip.textContent = chipAmount;
            
            if (chipAmount > 0) {
                elChip.classList.add('has-bet');
            } else {
                elChip.classList.remove('has-bet');
            }
        }
    }

    // 根據是否已下注 ANTE，來決定「發牌」按鈕是否啟用
    // 富貴三寶規定：必須落本注 (ANTE) 才可以發牌
    if (bets.ante > 0 && gameState === 'betting') {
        elBtnDeal.disabled = false;
    } else {
        elBtnDeal.disabled = true;
    }
}

function updateMessage(msg) {
    elGameMessage.textContent = msg;
}

// ==========================================
// 5. 事件監聽器綁定 (Event Listeners)
// ==========================================

// 為 5 個投注圈綁定點擊事件
for (let zone in elZones) {
    if (elZones[zone]) {
        elZones[zone].addEventListener('click', () => {
            placeBet(zone);
        });
    }
}

// 綁定清空按鈕
if (elBtnClear) {
    elBtnClear.addEventListener('click', clearAllBets);
}

// 初始執行一次 UI 更新，確保按鈕狀態正確
updateUI();

// ==========================================
// 6. 啤牌與洗牌核心邏輯 (Deck & Shuffling)
// ==========================================

// 定義花色與點數
const SUITS = [
    { name: 'spades', symbol: '♠', color: '#1a1a1a' },
    { name: 'hearts', symbol: '♥', color: '#e74c3c' },
    { name: 'diamonds', symbol: '♦', color: '#3498db' }, // 藍色或藍綠色更具現代感，亦可改用傳統紅 #e74c3c
    { name: 'clubs', symbol: '♣', color: '#27ae60' }   // 綠色或黑色
];

// 為了讓紅黑對比更傳統，你可以統一：hearts/diamonds 红色，spades/clubs 黑色
SUITS[0].color = '#1a1a1a'; // ♠ 黑色
SUITS[1].color = '#e74c3c'; // ♥ 紅色
SUITS[2].color = '#e74c3c'; // ♦ 紅色
SUITS[3].color = '#1a1a1a'; // ♣ 黑色

const VALUES = [
    { num: 2, label: '2' }, { num: 3, label: '3' }, { num: 4, label: '4' },
    { num: 5, label: '5' }, { num: 6, label: '6' }, { num: 7, label: '7' },
    { num: 8, label: '8' }, { num: 9, label: '9' }, { num: 10, label: '10' },
    { num: 11, label: 'J' }, { num: 12, label: 'Q' }, { num: 13, label: 'K' },
    { num: 14, label: 'A' }
];

let deck = [];         // 牌組 Array
let playerHand = [];   // 玩家手牌
let dealerHand = [];   // 莊家手牌
let communityHand = [];// Jackpot 公牌

/**
 * 初始化一副全新 52 張的啤牌
 */
function createDeck() {
    deck = [];
    for (let suit of SUITS) {
        for (let val of VALUES) {
            deck.push({
                suit: suit.name,
                symbol: suit.symbol,
                color: suit.color,
                value: val.num,
                label: val.label
            });
        }
    }
}

/**
 * Fisher-Yates 洗牌演算法 (保證絕對隨機與公平)
 */
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // 交換位置
    }
}

// ==========================================
// 7. 派牌與畫面渲染 (Dealing & Rendering)
// ==========================================
/**
 * 將一張牌的數據，轉化為 HTML 元素並塞入指定的 Container (特大橫排字+中央單花色版)
 * @param {Object} card - 啤牌物件
 * @param {HTMLElement} container - 要放入的 DOM 節點
 * @param {boolean} isFaceUp - 是否翻開 (面朝上)
 */
function renderCard(card, container, isFaceUp = true) {
    const cardEl = document.createElement('div');
    
    if (!isFaceUp) {
        cardEl.className = 'card card-back';
    } else {
        cardEl.className = 'card';
        cardEl.style.color = card.color;
        
        cardEl.innerHTML = `
            <!-- 左上角：再次放大的數字與花色橫排 -->
            <div class="card-index-group">
                <span class="card-index-num">${card.label}</span>
                <span class="card-index-suit">${card.symbol}</span>
            </div>
            
            <!-- 中央：統一只有一粒特大花色 -->
            <div class="card-single-center-suit">
                ${card.symbol}
            </div>
        `;
    }
    
    container.appendChild(cardEl);
}

/**
 * 處理「發牌 (Deal)」按鈕點擊事件
 */
function dealCards() {
    // 模擬真實賭場：每局發牌時彩池自動累積增長
    jackpotPoolAmount += Math.floor(Math.random() * 40) + 10;

    if (gameState !== 'betting' || bets.ante <= 0) return;

    // 1. 切換遊戲狀態至 'dealt' (已發牌)
    gameState = 'dealt';
    updateMessage("牌已發出！請選擇【加注 (Play)】回應莊家，或者【棄牌 (Fold)】。");

    // 2. 準備牌組
    createDeck();
    shuffleDeck();

    // 3. 清空手牌數據
    playerHand = [];
    dealerHand = [];
    communityHand = [];

    // 4. 分發啤牌數據 (富貴三寶各自拿 3 張，公牌 2 張)
    playerHand.push(deck.pop(), deck.pop(), deck.pop());
    dealerHand.push(deck.pop(), deck.pop(), deck.pop());
    communityHand.push(deck.pop(), deck.pop());

    // 5. 清空舊的網頁牌面
    document.getElementById('player-cards').innerHTML = '';
    document.getElementById('dealer-cards').innerHTML = '';
    document.getElementById('community-cards').innerHTML = '';

    // 【全新加入】進入發牌階段，強行讓所有籌碼降落回原位，不彈起身
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove('active-chip');
    });

    // 6. 渲染新牌到網頁畫面上
    // 玩家牌：面朝上
    playerHand.forEach(card => renderCard(card, document.getElementById('player-cards'), true));
    
    // 莊家牌：暫時面朝下 (保持神秘)
    dealerHand.forEach(card => renderCard(card, document.getElementById('dealer-cards'), false));
    
    // Jackpot 公牌：面朝上 (買了邊注的玩家可以即時對獎)
    communityHand.forEach(card => renderCard(card, document.getElementById('community-cards'), true));

    // 7. 鎖定下注與發牌按鈕，開啟決策按鈕
    elBtnDeal.disabled = true;
    elBtnClear.disabled = true;
    elBtnFold.disabled = false;
    elBtnPlay.disabled = false;
    
    // 高亮提示 Play 圈，引導玩家決定是否放入同等注額
    elZones.play.classList.add('active-zone');
    elZones.ante.classList.remove('active-zone');
}

// ==========================================
// 8. 綁定全新發牌事件
// ==========================================
if (elBtnDeal) {
    elBtnDeal.addEventListener('click', dealCards);
}

// ==========================================
// 9. 牌型判斷與分數計算核心 (Hand Evaluator)
// ==========================================

// 牌型等級分數：散牌=1, 對子=2, 同花=3, 順子=4, 三條=5, 同花順=6
const HAND_RANK = {
    HIGH_CARD: 1,
    PAIR: 2,
    FLUSH: 3,
    STRAIGHT: 4,
    THREE_OF_A_KIND: 5,
    STRAIGHT_FLUSH: 6
};

/**
 * 分析 3 張啤牌，回傳牌型等級與排序後的點數，方便平手時比 Kicker
 * @param {Array} cards - 3張牌的 Array
 * @return {Object} { rank: 牌型等級, name: 牌型名稱, values: 降序點數陣列 }
 */
function evaluate3CardHand(cards) {
    // 複製並依點數由大到小排序
    let sorted = [...cards].sort((a, b) => b.value - a.value);
    
    // 建立一個新的陣列 v 來儲存點數
    let v = [sorted[0].value, sorted[1].value, sorted[2].value];
    
    // 判斷同花 (三張牌花色完全相同)
    let isFlush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
    let isStraight = false;

    // 檢查普通順子 (例如 5,4,3)
    if (v[0] - v[1] === 1 && v[1] - v[2] === 1) {
        isStraight = true;
    }
    
    // 檢查特例：A-2-3 順子 (此時 v[0]為14, v[1]為3, v[2]為2)
    if (v[0] === 14 && v[1] === 3 && v[2] === 2) {
        isStraight = true;
        // 在 A-2-3 順子中，3 是最大的領頭羊，依次是 2，最後 A 算作 1 點
        // 我們直接對陣列的元素逐個賦值，絕對不會再出錯！
        v[0] = 3;
        v[1] = 2;
        v[2] = 1; 
    }

    // 1. 同花順
    if (isFlush && isStraight) {
        return { rank: HAND_RANK.STRAIGHT_FLUSH, name: "同花順", values: v };
    }
    
    // 2. 三條
    if (v[0] === v[1] && v[1] === v[2]) {
        return { rank: HAND_RANK.THREE_OF_A_KIND, name: "三條", values: v };
    }
    
    // 3. 順子
    if (isStraight) {
        return { rank: HAND_RANK.STRAIGHT, name: "順子", values: v };
    }
    
    // 4. 同花
    if (isFlush) {
        return { rank: HAND_RANK.FLUSH, name: "同花", values: v };
    }
    
    // 5. 對子
    // 前兩位放對子的點數，最後一位放單牌（Kicker）點數，方便後續 compareHands 逐個對比
    if (v[0] === v[1]) return { rank: HAND_RANK.PAIR, name: `對子 (${sorted[0].label})`, values: [v[0], v[1], v[2]] };
    if (v[1] === v[2]) return { rank: HAND_RANK.PAIR, name: `對子 (${sorted[1].label})`, values: [v[1], v[2], v[0]] };
    if (v[0] === v[2]) return { rank: HAND_RANK.PAIR, name: `對子 (${sorted[0].label})`, values: [v[0], v[2], v[1]] };

    // 6. 散牌
    return { rank: HAND_RANK.HIGH_CARD, name: `高牌 (${sorted[0].label})`, values: v };
}


// ==========================================
// 10. 邊注高級算法 (6-Card & Jackpot)
// ==========================================

function getPairPlusMultiplier(rank) {
    if (rank === HAND_RANK.STRAIGHT_FLUSH) return 40; 
    if (rank === HAND_RANK.THREE_OF_A_KIND) return 30; 
    if (rank === HAND_RANK.STRAIGHT) return 6;        
    if (rank === HAND_RANK.FLUSH) return 4;           
    if (rank === HAND_RANK.PAIR) return 1;            
    return 0;
}

/**
 * 澳門富貴三寶官方 6-Card Bonus 算法
 * 結合玩家3張+莊家3張（共6張），挑選出最佳的 5 張德州撲克牌型進行結算
 */
function checkSixCardBonus() {
    if (bets.sixcard <= 0) return 0;
    
    let all6 = [...playerHand, ...dealerHand];
    
    // 計算相同點數的張數
    let counts = {};
    all6.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
    let maxSame = Math.max(...Object.values(counts));
    let pairsCount = Object.values(counts).filter(v => v === 2).length;
    
    // 計算同花
    let suitCounts = {};
    all6.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
    let isFlush = Math.max(...Object.values(suitCounts)) >= 5;

    // 檢查順子 (簡化版連續檢查)
    let uniqueVals = [...new Set(all6.map(c => c.value))].sort((a,b)=>a-b);
    let straightCount = 0;
    for(let i=0; i<uniqueVals.length-1; i++) {
        if(uniqueVals[i+1] - uniqueVals[i] === 1) straightCount++;
        else if (uniqueVals[i+1] - uniqueVals[i] > 1 && straightCount < 4) straightCount = 0;
    }
    let isStraight = straightCount >= 4 || (uniqueVals.includes(14)&&uniqueVals.includes(2)&&uniqueVals.includes(3)&&uniqueVals.includes(4)&&uniqueVals.includes(5));

    // ==========================================
    // 澳門政府官方 6-Card Bonus 標準賠率表
    // ==========================================
    if (isFlush && isStraight && uniqueVals.includes(14) && uniqueVals.includes(13)) {
        return 500; // 黃袍麒 (皇家同花順)：1 賠 500
    }
    if (isFlush && isStraight) return 100; // 同花順：1 賠 100
    if (maxSame >= 4) return 50;           // 四條：1 賠 50
    if (maxSame === 3 && pairsCount >= 1) return 20; // 夫盧 (葫蘆)：1 賠 20
    if (isFlush) return 15;                // 同花：1 賠 15
    if (isStraight) return 10;             // 順子：1 賠 10
    if (maxSame === 3) return 7;           // 三條：1 賠 7  <-- 【在此徹底修正！】
    
    return 0; // 散牌或一對，沒中獎
}


/**
 * 修正版：澳門官方 Jackpot 累進大獎算法 (5張牌德州撲克組合)
 */
function checkJackpotBonus() {
    if (bets.jackpot <= 0) return { win: false, msg: "", payout: 0 };
    let all5 = [...playerHand, ...communityHand];
    
    // 1. 計算相同點數的張數
    let counts = {};
    all5.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
    let maxSame = Math.max(...Object.values(counts));
    let valCounts = Object.values(counts);
    let hasThree = valCounts.includes(3);
    let hasPair = valCounts.includes(2);
    
    // 2. 計算同花
    let suitCounts = {};
    all5.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
    let isFlush = Math.max(...Object.values(suitCounts)) === 5;
    
    // 3. 檢查順子 (包含 A-2-3-4-5 特例)
    let vals = all5.map(c => c.value).sort((a,b)=>a-b);
    let isStraight = true;
    for(let i=0; i<vals.length-1; i++) {
        if(vals[i+1] - vals[i] !== 1) isStraight = false;
    }
    // A-2-3-4-5 順子特例檢查
    if (vals[4]===14 && vals[0]===2 && vals[1]===3 && vals[2]===4 && vals[3]===5) {
        isStraight = true;
    }
    
    // ==========================================
    // 精準對齊玩家提供的 Jackpot 累進獎勵表
    // ==========================================
    
    // 皇家同花順 (10-J-Q-K-A 同花)：贏 100% 彩池
    if (isFlush && isStraight && vals[0] === 10) {
        let winAmt = jackpotPoolAmount;
        jackpotPoolAmount = 5000; // 彩池被清空，重設回基礎種子基金
        return { win: true, msg: "🔥 震撼全場！爆出 JACKPOT 皇家同花順！獨得 100% 巨額彩金！", payout: winAmt, isFixed: true };
    }
    
    // 同花順：贏 10% 彩池
    if (isFlush && isStraight) {
        let winAmt = Math.floor(jackpotPoolAmount * 0.10);
        jackpotPoolAmount -= winAmt; // 彩池扣減 10%
        return { win: true, msg: "🎉 恭喜擊中【同花順 Jackpot】！分得 10% 累進彩池！", payout: winAmt, isFixed: true };
    }
    
    // 四條：固定派發 $5000
    if (maxSame === 4) {
        return { win: true, msg: "🎉 擊中【四條 Jackpot】！固定獎金派發", payout: 5000, isFixed: true };
    }
    
    // 夫盧 (葫蘆：三條加一對)：固定派發 $3000
    if (hasThree && hasPair) {
        return { win: true, msg: "🎉 擊中【夫盧 Jackpot】！固定獎金派發", payout: 3000, isFixed: true };
    }
    
    // 同花：固定派發 $2000
    if (isFlush) {
        return { win: true, msg: "🎉 擊中【同花 Jackpot】！固定獎金派發", payout: 2000, isFixed: true };
    }
    
    return { win: false, msg: "", payout: 0 };
}


// ==========================================
// 11. 遊戲決策與派彩結算 (Fold & Play Logic)
// ==========================================

function compareHands(pEval, dEval) {
    if (pEval.rank !== dEval.rank) {
        return pEval.rank > dEval.rank ? 1 : -1;
    }
    for (let i = 0; i < pEval.values.length; i++) {
        if (pEval.values[i] !== dEval.values[i]) {
            return pEval.values[i] > dEval.values[i] ? 1 : -1;
        }
    }
    return 0; 
}

function fold() {
    if (gameState !== 'dealt') return;
    gameState = 'resolved';
    updateMessage("❌ 你選擇了棄牌。輸掉了本注 (Ante)。");
    let sideBetPayouts = settleSideBets();
    revealDealerCards();
    zeroAllBets();
    updateUI();
    resetControlButtons();
}

/**
 * 玩家選擇「加注 (Play)」(完美同步加入 Ante Bonus 正宗賭場版)
 */
/**
 * 玩家選擇「加注 (Play)」(升級版：精確統計並回報總贏取彩金)
 */
/**
 * 完美修復版：玩家選擇「加注 (Play)」(精確計算純利潤，絕不報假數)
 */
function play() {
    if (gameState !== 'dealt') return;
    const playAmount = bets.ante;
    if (totalBalance < playAmount) {
        updateMessage("❌ 餘額不足，不夠資金進行加注 (Play)！");
        return;
    }
    
    // 計算這局在發牌前與加注時的【總投入成本】
    const totalBetCost = bets.jackpot + bets.pairplus + bets.ante + bets.sixcard + playAmount;
    
    totalBalance -= playAmount;
    bets.play = playAmount;
    gameState = 'resolved';
    revealDealerCards();
    
    let playerEval = evaluate3CardHand(playerHand);
    let dealerEval = evaluate3CardHand(dealerHand);
    
    let summaryMessage = `你手牌：【${playerEval.name}】。莊家手牌：【${dealerEval.name}】。`;
    
    // 莊家成局資格：必須高牌 Q 或以上 (rank > 1 或 最大牌點數 >= 12)
    let dealerQualifies = (dealerEval.rank > HAND_RANK.HIGH_CARD) || (dealerEval.values[0] >= 12);
    let mainBetReturned = 0; // 這局主注最終拿回來的【本利和】
    
    // 1. 計算常規主注 (Ante 與 Play) 拿回的金額
    if (!dealerQualifies) {
        mainBetReturned += bets.ante * 2; // Ante 贏一倍：退本 + 贏一份
        mainBetReturned += bets.play;     // Play 走牌：原退本金
        summaryMessage += " 莊家不成局（不夠 Q）！本注獲勝，加注走牌。";
    } else {
        let result = compareHands(playerEval, dealerEval);
        if (result === 1) {
            mainBetReturned += bets.ante * 2; // Ante 贏一倍
            mainBetReturned += bets.play * 2; // Play 贏一倍
            summaryMessage += " 👍 你贏了莊家！主注雙贏！";
        } else if (result === -1) {
            mainBetReturned += 0;             // 輸光
            summaryMessage += " 😮 莊家牌大，你輸了主注。";
        } else {
            mainBetReturned += bets.ante;     // 平手退本
            mainBetReturned += bets.play;     // 平手退本
            summaryMessage += " 🤝 雙方平手，走牌！";
        }
    }
    totalBalance += mainBetReturned;

    // 2. 正宗賭場專屬：ANTE BONUS 額外獎賞結算
    let anteBonusWin = 0;
    if (playerEval.rank === HAND_RANK.STRAIGHT_FLUSH) {
        anteBonusWin = bets.ante * 5;
        summaryMessage += ` 🎖️ 額外贏得【同花順 Ante Bonus】$${anteBonusWin}！`;
    } else if (playerEval.rank === HAND_RANK.THREE_OF_A_KIND) {
        anteBonusWin = bets.ante * 4;
        summaryMessage += ` 🎖️ 額外贏得【三條 Ante Bonus】$${anteBonusWin}！`;
    } else if (playerEval.rank === HAND_RANK.STRAIGHT) {
        anteBonusWin = bets.ante * 1;
        summaryMessage += ` 🎖️ 額外贏得【順子 Ante Bonus】$${anteBonusWin}！`;
    }
    totalBalance += anteBonusWin;

    // 3. 結算所有邊注 (Pair Plus, 6-Card, Jackpot) 獲取邊注拿回來的總本利和
    let sideBetObj = settleSideBets();
    totalBalance += sideBetObj.totalReturned; 
    summaryMessage += sideBetObj.msg;

    // ==========================================
    // 核心修復：用【總拿回金額】減去【總投入成本】計算純利潤
    // ==========================================
    const totalReturnedFromCasino = mainBetReturned + anteBonusWin + sideBetObj.totalReturned;
    const netProfit = totalReturnedFromCasino - totalBetCost; // 正數代表純贏，負數代表純輸

    if (netProfit > 0) {
        summaryMessage += ` ✨ 🎉【本局淨贏得: $${netProfit}】🎉`;
    } else if (netProfit < 0) {
        summaryMessage += ` ❌【本局淨輸掉: $${Math.abs(netProfit)}】`;
    } else {
        summaryMessage += ` 🤝【本局完全平手，無輸無贏】`;
    }

    updateMessage(summaryMessage);
    zeroAllBets();
    updateUI();
    resetControlButtons();
}

/**
 * 結算邊注 (配合新版派彩，回傳詳細的金額數據物件)
 */
function settleSideBets() {
    let msg = "";
    let pureWin = 0;        // 邊注純賺取的利潤
    let totalReturned = 0;  // 邊注最終拿回來的總本利和
    
    let playerEval = evaluate3CardHand(playerHand);
    
    // 1. Pair Plus 結算
    if (bets.pairplus > 0) {
        let mult = getPairPlusMultiplier(playerEval.rank);
        if (mult > 0) {
            let winAmt = bets.pairplus * mult;      // 純利潤
            totalReturned += bets.pairplus * (mult + 1); // 本利和
            pureWin += winAmt;
            msg += ` 💰 Pair Plus 擊中【${playerEval.name}】贏 $${winAmt}！`;
        } else {
            msg += " Pair Plus 沒中獎。";
        }
    }
    
    // 2. 6-Card Bonus 結算
    if (bets.sixcard > 0) {
        let tragicMult = checkSixCardBonus();
        if (tragicMult > 0) {
            let winAmt = bets.sixcard * tragicMult;
            totalReturned += bets.sixcard * (tragicMult + 1);
            pureWin += winAmt;
            msg += ` 🔮 6-Card Bonus 擊中贏 $${winAmt}！`;
        } else {
            msg += " 6-Card 沒中獎。";
        }
    }
    
    // 3. Jackpot 大獎結算 (Jackpot 本身是抽水彩池/固定派發，贏得的金額即是純利潤)
    if (bets.jackpot > 0) {
        let jackResult = checkJackpotBonus();
        if (jackResult.win) {
            totalReturned += jackResult.payout;
            pureWin += jackResult.payout;
            msg += ` ${jackResult.msg} 贏得 $${jackResult.payout}！`;
        } else {
            msg += " Jackpot 沒中獎。";
        }
    }
    
    // 將數據打包回傳
    return {
        msg: msg,
        pureWin: pureWin,
        totalReturned: totalReturned
    };
}

function revealDealerCards() {
    const dealerContainer = document.getElementById('dealer-cards');
    dealerContainer.innerHTML = '';
    dealerHand.forEach(card => renderCard(card, dealerContainer, true));
}

function zeroAllBets() {
    bets.jackpot = 0;
    bets.pairplus = 0;
    bets.ante = 0;
    bets.play = 0;
    bets.sixcard = 0;
}

/**
 * 結算後，進入等待下一局狀態，開啟「下一局」按鈕
 */
function resetControlButtons() {
    elBtnDeal.disabled = true;
    elBtnClear.disabled = false;
    elBtnFold.disabled = true;
    elBtnPlay.disabled = true;
    elBtnNext.disabled = false; // 開啟「下一局」按鈕
    
    gameState = 'resolved'; // 保持在已結算狀態，直到點擊下一局或重新下注
    
    elZones.play.classList.remove('active-zone');
    elZones.ante.classList.add('active-zone');
}

/**
 * 將檯面上的所有牌面清空，恢復成 3張莊家、2張公牌、3張玩家的「蓋牌」背面模樣
 */
function resetCardsToBack() {
    // 重置莊家牌背
    const dContainer = document.getElementById('dealer-cards');
    dContainer.innerHTML = '<div class="card card-back"></div><div class="card card-back"></div><div class="card card-back"></div>';
    
    // 重置公牌牌背
    const cContainer = document.getElementById('community-cards');
    cContainer.innerHTML = '<div class="card card-back card-community"></div><div class="card card-back card-community"></div>';
    
    // 重置玩家牌背
    const pContainer = document.getElementById('player-cards');
    pContainer.innerHTML = '<div class="card card-back"></div><div class="card card-back"></div><div class="card card-back"></div>';
    
    // 【全新加入】恢復下注階段時，讓目前預設的面額籌碼重新高亮彈起
    const defaultChip = document.querySelector(`.chip-${selectedChipValue}`);
    if (defaultChip) {
        defaultChip.classList.add('active-chip');
    }

    // 進入全新下注階段
    gameState = 'betting';
    elBtnNext.disabled = true; // 蓋牌後禁用下一局按鈕
    updateMessage("請放入本注（Ante）開始遊戲");
    updateUI();
}


// ==========================================
// 12. 綁定大結局事件監聽器
// ==========================================
if (elBtnFold) elBtnFold.addEventListener('click', fold);
if (elBtnPlay) elBtnPlay.addEventListener('click', play);
if (elBtnNext) elBtnNext.addEventListener('click', resetCardsToBack);

// ==========================================
// 13. 賠率說明彈窗控制邏輯
// ==========================================
const elBtnInfo = document.getElementById('btn-info');
const elBtnCloseModal = document.getElementById('btn-close-modal');
const elInfoModal = document.getElementById('info-modal');

if (elBtnInfo && elInfoModal) {
    // 點擊「賠率說明」按鈕打開彈窗
    elBtnInfo.addEventListener('click', () => {
        elInfoModal.classList.add('show-modal');
    });
}

if (elBtnCloseModal && elInfoModal) {
    // 點擊「X」按鈕關閉彈窗
    elBtnCloseModal.addEventListener('click', () => {
        elInfoModal.classList.remove('show-modal');
    });
}

if (elInfoModal) {
    // 點擊彈窗外圍黑色半透明遮罩層也可以直接關閉
    elInfoModal.addEventListener('click', (e) => {
        if (e.target === elInfoModal) {
            elInfoModal.classList.remove('show-modal');
        }
    });
}
