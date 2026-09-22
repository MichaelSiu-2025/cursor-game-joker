// ==========================================
// 1. 全域狀態初始化 (Game State)
// ==========================================
let totalBalance = 50000;        // 玩家初始總資產變成 $5000
let selectedChipValue = 100;     // 預設選中的籌碼面額改為 $100
let jackpotPoolAmount = 6225485;  // <-- 全新加入：用來動態紀錄累進彩池的真實金額

// ==========================================
// 💡 全新加入：荷官幸運值機率操縱大腦 (預設新開遊戲係 100)
// ==========================================
let currentLuckFactor = 100; // 50 = 最差地獄, 100 = 常規普通, 118 = 最高天堂

// 【全新加入】快捷下注全域大腦變數
let lastRoundBets = null; // 用來儲存上一局完結時的注碼快照

const elBtnRebet = document.getElementById('btn-rebet');
const elBtnDouble = document.getElementById('btn-double');
const elBtnChangeDealer = document.getElementById('btn-change-dealer');

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
// 1.5 全新加入：線上賭場專用高質感音效物件
// ==========================================
// 直接讀取你剛剛放在同一個資料夾內的本地 MP3 檔案
const soundChip = new Audio('chip.mp3'); 
const soundCard = new Audio('card.mp3');
const soundWinning = new Audio('winning.mp3'); // <-- 【全新加入】贏錢慶典音效
const soundLosing = new Audio('losing.mp3'); // <-- 【全新加入】輸錢沮喪音效
const soundDraw = new Audio('draw.mp3'); // <-- 【全新加入】和局走牌音效
const soundCoin = new Audio('coin.mp3'); // <-- 全新加入：籌碼飛入錢包的吸金撞擊聲
// 【全新加入】背景音樂物件
const bgm = new Audio('XXXbackgroundMusic1.mp3'); 
bgm.loop = true;          // 核心設定：開啟無限循環播放！
bgm.volume = 0.2;        // 防禦設定：背景音樂音量設為 25%，既能優雅襯托氣氛，又絕對不會刺耳或蓋過遊戲音效！

// 設置防禦：微調音量，確保聲音清脆而不刺耳
soundChip.volume = 0.2;
soundCard.volume = 0.5;
soundWinning.volume = 0.3; // 贏錢要夠響亮、夠大聲！
soundLosing.volume = 0.2; // 輸錢音量適中即可，增加氛圍感
soundDraw.volume = 0.4; // 和局音量適中
if (soundCoin) soundCoin.volume = 0.4;

/**
 * 瀏覽器安全解鎖大師 (專治 iOS Safari 預設靜音限制)
 */
function unlockAudio() {
    // 透過玩家點擊網頁的一瞬間，在背景播放一次無聲的音訊，強行向 iPhone 爭取聲音權限
    soundChip.play().then(() => { soundChip.pause(); soundChip.currentTime = 0; }).catch(() => {});
    soundCard.play().then(() => { soundCard.pause(); soundCard.currentTime = 0; }).catch(() => {});
    soundWinning.play().then(() => { soundWinning.pause(); soundWinning.currentTime = 0; }).catch(() => {});
    soundLosing.play().then(() => { soundLosing.pause(); soundLosing.currentTime = 0; }).catch(() => {});
    soundDraw.play().then(() => { soundDraw.pause(); soundDraw.currentTime = 0; }).catch(() => {})
    if (soundCoin) soundCoin.play().then(() => { soundCoin.pause(); soundCoin.currentTime = 0; }).catch(() => {});

    // 【核心啟動】在玩家點擊的這一下，同步流暢地將背景音樂無限循環播出來！
    bgm.play().catch((err) => {
        console.log("BGM 播放受阻，等待下一次互動", err);
    });

    // 解鎖一次後，立刻自我銷毀這個監聽器，絕不浪費手機 CPU 效能
    document.removeEventListener('click', unlockAudio);
}
// 當玩家第一次在網頁上任何地方點擊時，立刻觸發解鎖
document.addEventListener('click', unlockAudio);

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
 * 處理下注點擊事件 (更新版：加入了 JACKPOT 固定 \$50 港元硬性限制)
 */
function placeBet(zoneName) {
    // 1. 如果上局剛結算完，玩家直接點擊下注，自動執行蓋牌重置新局
    if (gameState === 'resolved') {
        resetCardsToBack();
    }

    // 2. 只有在下注階段才可以下注
    if (gameState !== 'betting') return;

    // 3. PLAY 圈不能直接手動下注，必須等發牌後點擊「加注」按鈕
    if (zoneName === 'play') {
        updateMessage("💡 PLAY 圈不能直接下注，請先買 ANTE 並點擊發牌。");
        return;
    }

    // ==========================================
    // 💡 官方硬性規定：【JACKPOT 固定 \$50 限制防線】
    // ==========================================
    let currentBetAmount = selectedChipValue; // 預設使用玩家當前選中的籌碼面額

    if (zoneName === 'jackpot') {
        // 限制 A：如果玩家已經買了 Jackpot（金額大於 0），直接鎖死拦截，絕對不允許重複疊加！
        if (bets.jackpot > 0) {
            updateMessage("💡 官方規則：累進大獎 (Jackpot) 每局只能固定投注 \$50，不能重複加注。");
            return;
        }
        // 限制 B：不管玩家選中 100 還是 10000 籌碼，點擊 Jackpot 圈一律強制改為 \$50！
        currentBetAmount = 50;
    }

    // 4. 檢查全域錢包餘額是否足夠放入該筆注碼
    if (totalBalance < currentBetAmount) {
        updateMessage("❌ 餘額不足，不夠放入該面額的籌碼！");
        return;
    }

    // 5. 正式從全域錢包扣錢，並增加該注區的注碼快照
    totalBalance -= currentBetAmount;
    bets[zoneName] += currentBetAmount;

    // 每次成功下注，清脆播放籌碼撞擊聲
    if (soundChip) {
        soundChip.currentTime = 0;
        soundChip.play().catch(() => {});
    }

    // 6. 戰報調侃提示
    if (zoneName === 'jackpot') {
        updateMessage("🎰 成功放入固定 \$50 Jackpot 累進大獎邊注！祝你撞出皇家同花順！");
    } else {
        updateMessage(`經已在 ${zoneName.toUpperCase()} 放入 $${currentBetAmount} 注碼。`);
    }

    // 7. 刷新 UI 畫面渲染
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

    // 【音效注入】清空下注時響起收回籌碼聲
    soundChip.currentTime = 0;
    soundChip.play().catch(() => {});

    updateMessage("請放入本注（Ante）開始遊戲");
    updateUI();
}

/**
 * 終極淨化版：純粹畫面渲染更新 (阻斷任何在背景偷扣錢的幽靈監聽)
 */
function updateUI() {
    if (!elTotalBalance) return;

    // ==========================================
    // 💡 【鋼鐵防線】精密保護全域資金數字
    // ==========================================
    // 如果目前已經撳咗加注、處於結算中或已結算階段 (resolved)
    if (gameState === 'resolved') {
        // 強制、雷打不動地在畫面上鎖定顯示扣除加注後的最正確數字，背景的所有幽靈扣款一律作廢！
        elTotalBalance.textContent = totalBalance; 
    } else {
        // 常規下注或發牌階段，老實印出
        elTotalBalance.textContent = totalBalance;
    }

        // ==========================================
    // 🔮 全新加入：說明彈窗內「隱藏幸運值」實時同步與氣氛燈控制
    // ==========================================
    const elModalLuckValue = document.getElementById('modal-luck-value');
    if (elModalLuckValue) {
        // 1. 將全域最新重軋出來的幸運值數字填入說明最下方
        elModalLuckValue.textContent = currentLuckFactor;
        
        // 2. 根據數值高低自適應變色，讓運氣好壞一目了然！
        if (currentLuckFactor > 100) {
            elModalLuckValue.style.color = '#2ecc71'; // 好運爆棚 ➡️ 璀璨綠
            elModalLuckValue.style.textShadow = '0 0 8px rgba(46, 204, 113, 0.6)';
        } else if (currentLuckFactor < 100) {
            elModalLuckValue.style.color = '#e74c3c'; // 黑仔地獄 ➡️ 警示紅
            elModalLuckValue.style.textShadow = '0 0 8px rgba(231, 76, 60, 0.6)';
        } else {
            elModalLuckValue.style.color = '#ffd700'; // 常規普通 ➡️ 尊貴金
            elModalLuckValue.style.textShadow = 'none';
        }
    }

    // 更新畫面上的 Jackpot 實時彩池數字
    const elPool = document.querySelector('.jackpot-pool');
    if (elPool) elPool.textContent = `$${jackpotPoolAmount.toLocaleString()}`;

    // 更新四個下注圈的籌碼顯示 (演派彩動畫時，不要強行刷走中獎贏利數字)
    for (let zone in bets) {
        if (zone === 'play') continue; // 手機版已移除 play 圈
        const chipEl = document.getElementById(`chip-${zone}`);
        const zoneEl = document.getElementById(`zone-${zone}`);
        
        if (chipEl && zoneEl) {
            // 只有在非動畫結算等待階段，才顯示常規下注額，並清除金光樣式
            if (gameState !== 'resolved' && !zoneEl.classList.contains('payout-glow')) {
                chipEl.textContent = bets[zone];
                if (bets[zone] > 0) {
                    chipEl.style.display = 'flex';
                    zoneEl.classList.add('has-bet');
                } else {
                    chipEl.style.display = 'none';
                    zoneEl.classList.remove('has-bet');
                }
            } else if (bets[zone] === 0) {
                // 如果是下一局重置了，順手把金光拔掉
                zoneEl.classList.remove('payout-glow');
                chipEl.textContent = 0;
                chipEl.style.display = 'none';
                zoneEl.classList.remove('has-bet');
            }
        }
    }

    // 根據是否已下注 ANTE，來決定「發牌」按鈕是否啟用
    if (bets.ante > 0 && gameState === 'betting') {
        elBtnDeal.disabled = false;
    } else {
        elBtnDeal.disabled = true;
    }

    // ==========================================
    // 💡 快捷按鈕開關鎖精準控制 (不影響資金)
    // ==========================================
    if (elBtnRebet && elBtnDouble) {
        const isCurrentTableEmpty = (bets.ante === 0 && bets.pairplus === 0 && bets.sixcard === 0 && bets.jackpot === 0);
        const hasAnyBetOnTable = (bets.ante > 0 || bets.pairplus > 0 || bets.sixcard > 0 || bets.jackpot > 0);

        if (gameState === 'betting') {
            elBtnRebet.disabled = !(lastRoundBets && isCurrentTableEmpty);
            elBtnDouble.disabled = !hasAnyBetOnTable;
            if (elBtnChangeDealer) elBtnChangeDealer.disabled = false; // 下注中，允許更換荷官
        } else if (gameState === 'resolved') {
            elBtnRebet.disabled = !lastRoundBets; 
            elBtnDouble.disabled = true;
            if (elBtnChangeDealer) elBtnChangeDealer.disabled = false; // 已結算亮牌，允許更換荷官
        } else {
            elBtnRebet.disabled = true;
            elBtnDouble.disabled = true;
            if (elBtnChangeDealer) elBtnChangeDealer.disabled = true;  // 發牌決策中，禁止更換
        }
    }
} // updateUI 函數正式結束

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
 * 將一張牌的數據，轉化為 HTML 3D 翻牌元素並塞入指定的 Container
 * @param {Object} card - 啤牌物件
 * @param {HTMLElement} container - 要放入的 DOM 節點
 * @param {boolean} isFaceUp - 是否立馬翻開（玩家牌和公牌直接翻，莊家牌先保持背面）
 */
function renderCard(card, container, isFaceUp = true) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    
    // 生成包含正反雙面的 3D 夾心結構
    cardEl.innerHTML = `
        <div class="card-inner">
            <!-- 1. 牌背面 -->
            <div class="card-back"></div>
            
            <!-- 2. 牌正面 -->
            <div class="card-front" style="color: ${card.color};">
                <!-- 左上角橫排大字 -->
                <div class="card-index-group">
                    <span class="card-index-num">${card.label}</span>
                    <span class="card-index-suit">${card.symbol}</span>
                </div>
                <!-- 中央特大花色 -->
                <div class="card-single-center-suit">
                    ${card.symbol}
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(cardEl);
    
    // 如果需要翻開，延時 50 毫秒（給予網頁瀏覽器渲染時間）後加上 .flipped 觸發 3D 旋轉動畫
    if (isFaceUp) {
        setTimeout(() => {
            cardEl.classList.add('flipped');
            
            // 【神級優化】重置並強制跳過開頭的 0.15 秒空白，直接從有聲音的地方爆發出來！
            soundCard.currentTime = 0.15; // ※ 如果玩起來覺得還有一點點 delay，可以嘗試加大到 0.2 或 0.25
            soundCard.play().catch(() => {});
        }, 50);
    }
    
    return cardEl; // 回傳這個節點，方便後續控制
}

/**
 * 終極無瑕完工版：發牌 (Deal) 核心大腦 (徹底根治卡死與重複扣款)
 */
function dealCards() {
    // 1. 【精密防禦】只有在下注階段，且有買本注 ANTE 的時候才允許發牌
    if (gameState !== 'betting' || bets.ante <= 0) return;

    // 2. 【核心大撥亂反正】因為下注 placeBet() 時錢包已經精準即時扣了錢，
    // 這時全域的 totalBalance 經已是最正確的餘額 \$47000。
    // 我們在這裡老老實實把 \$47000 印在畫面上，絕對、百分之百不准寫任何減法！
    if (elTotalBalance) {
        elTotalBalance.textContent = totalBalance; 
    }

    // 發牌前，Play 圈此時必須強制為 0，防止時空幽靈數據殘留
    bets.play = 0;
    
    // 【關鍵核心修正】立刻將狀態切換為 'dealt'（已發牌階段）
    // 阻斷 updateUI() 和背景的所有舊監聽器，直接封死背景偷扣錢的後門！
    gameState = 'dealt';
    
    updateMessage("正在發牌中...");

    // 彩池微增
    jackpotPoolAmount += Math.floor(Math.random() * 40) + 10;

    // 重新洗牌與抽牌
    createDeck();
    shuffleDeck();

// 徹底歸零並重新分配手牌
    playerHand = [];
    dealerHand = [];
    communityHand = [];

    // 1. 率先抽取莊家牌與公牌 (維持完全常規隨機，不作任何手腳)
    dealerHand.push(deck.pop(), deck.pop(), deck.pop());
    communityHand.push(deck.pop(), deck.pop());

    // 2. 【核心機率操控：抽玩家手牌】
    // 我們先正常幫玩家抽 3 張牌
    playerHand.push(deck.pop(), deck.pop(), deck.pop());
    let currentEval = evaluate3CardHand(playerHand); // 評估這手牌的牌型

    // 💡 命運干涉天窗 ➡️ 根據幸運值高低，決定要不要進行「作弊重抽」
    if (currentLuckFactor > 100) {
        // 【天堂好運機制】：如果抽到的是散牌(HIGH_CARD)，有一定機率強行退貨重抽！
        // 幸運值越高，退貨率越高 (例如 118 分時，有高達 75% 的概率把爛散牌直接換掉！)
        const redrawProbability = (currentLuckFactor - 100) / 24; // 算出一筆 0 到 0.75 的概率
        
        if (currentEval.rank === HAND_RANK.HIGH_CARD && Math.random() < redrawProbability) {
            // 執行好運退貨：把這3張爛牌塞回牌組最底層，重新再抽3張！
            deck.unshift(playerHand.pop(), playerHand.pop(), playerHand.pop());
            playerHand.push(deck.pop(), deck.pop(), deck.pop());
        }
    } else if (currentLuckFactor < 100) {
        // 【黑仔地獄機制】：如果玩家好運抽到了對子(PAIR)或以上的好牌，
        // 有一定機率被黑仔大腦強行沒收，逼你重新抽 3 張，極大概率降級成散牌！
        // 50 分時最慘，有高達 75% 的概率把你的好牌生生搶走！
        const badLuckProbability = (100 - currentLuckFactor) / 66.6; // 算出一筆 0 到 0.75 的地獄概率
        
        if (currentEval.rank > HAND_RANK.HIGH_CARD && Math.random() < badLuckProbability) {
            // 執行地獄沒收：把你的好牌沒收塞回，逼你重新抽3張差牌！
            deck.unshift(playerHand.pop(), playerHand.pop(), playerHand.pop());
            playerHand.push(deck.pop(), deck.pop(), deck.pop());
        }
    }

    // ==========================================
    // 💡 核心修復：【重新獲取並精準宣告三個發牌 HTML 容器】
    // 確保下方 forEach 執行時絕對認得它們，100% 拒絕死機卡死！
    // ==========================================
    const pContainer = document.getElementById('player-cards');
    const dContainer = document.getElementById('dealer-cards');
    const cContainer = document.getElementById('community-cards');

    // 發牌前先將檯面上的初始蓋牌清空乾淨
    if (pContainer) pContainer.innerHTML = '';
    if (dContainer) dContainer.innerHTML = '';
    if (cContainer) cContainer.innerHTML = '';

    // 立即鎖定所有控制按鈕，防止發牌期間玩家重複狂點
    if (elBtnDeal) elBtnDeal.disabled = true;
    if (elBtnClear) elBtnClear.disabled = true;
    if (elBtnRebet) elBtnRebet.disabled = true;
    if (elBtnDouble) elBtnDouble.disabled = true;
    if (elBtnFold) elBtnFold.disabled = true;
    if (elBtnPlay) elBtnPlay.disabled = true;

    // 依次 3D 發牌與翻牌，行雲流水！
    playerHand.forEach((card, index) => {
        setTimeout(() => { 
            if (pContainer) renderCard(card, pContainer, true); 
        }, index * 150);
    });

    dealerHand.forEach((card, index) => {
        setTimeout(() => { 
            if (dContainer) renderCard(card, dContainer, false); 
        }, 450 + (index * 150));
    });

    communityHand.forEach((card, index) => {
        setTimeout(() => {
            if (cContainer) renderCard(card, cContainer, true);
            
            // 當最後一張公牌完全派發完畢後
            if (index === communityHand.length - 1) {
                updateMessage("牌已發出！請選擇【加注】回應莊家，或者【棄牌】。");
                
                // 派牌完畢，更新 Jackpot 數字
                const elPool = document.querySelector('.jackpot-pool');
                if (elPool) elPool.textContent = `$${jackpotPoolAmount.toLocaleString()}`;
                
                // 唯獨安全解鎖「加注」與「棄牌」按鈕，讓玩家做決定
                if (elBtnFold) elBtnFold.disabled = false;
                if (elBtnPlay) elBtnPlay.disabled = false;
                
                // 呼叫 updateUI() 刷新快捷鈕狀態
                updateUI();
            }
        }, 900 + (index * 150));
    });
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

/**
 * 終極完工版：玩家選擇「棄牌 (Fold)」(徹底根治棄牌重複扣款 BUG)
 */
function fold() {
    // 防禦鎖：只有在發牌抉擇階段才允許撳棄牌
    if (gameState !== 'dealt') return;

    // 1. 【快捷大腦】在清空前，搶先拍照備份發牌前的純淨注碼快照，供下一局「重複下注」使用
    lastRoundBets = {
        jackpot: bets.jackpot,
        pairplus: bets.pairplus,
        ante: bets.ante,
        sixcard: bets.sixcard,
        play: 0
    };

    // 2. ⚠️【核心大撥亂反正】因為下注時錢包已經即時扣了 \$3000，
    // 棄牌純粹代表認輸、不拿回這筆錢。所以全域變數 totalBalance 絕對不准再做任何減法！
    
    // 3. 立刻將狀態切換為已結算階段！這一步配合 updateUI()，能瞬間在畫面上把數字死死鎖定！
    gameState = 'resolved';
    
    updateMessage("❌ 你選擇了棄牌 (Fold)，輸掉了本手注碼。");

    // 4. 先將落注圈的小籌碼在畫面上隱形
    for (let zone in bets) {
        const chipEl = document.getElementById(`chip-${zone}`);
        const zoneEl = document.getElementById(`zone-${zone}`);
        if (chipEl) chipEl.style.display = 'none';
        if (zoneEl) zoneEl.classList.remove('has-bet');
    }

    // 5. 【核心順序優化】清空下注圈金額前，我們先把 gameState 暫時改回 'betting'，
    // 這樣 zeroAllBets() 後 updateUI() 才能把四個圈圈乾淨抹除成 0
    gameState = 'betting';
    zeroAllBets(); // 清空當前 bets
    
    // 徹底刷新大腦 UI，此時 bets 為 0，錢包數字會百分之百完美亮出最正確的真實餘額（例如 \$47000），絕不跳水！
    updateUI(); 

    // 6. 演完後，重新把 gameState 鎖回 'resolved'，並安全解鎖開啟「下一局」按鈕
    gameState = 'resolved';
    if (elBtnNext) elBtnNext.disabled = false;
    
    // 禁用發牌、棄牌、加注等按鈕
    if (elBtnDeal) elBtnDeal.disabled = true;
    if (elBtnFold) elBtnFold.disabled = true;
    if (elBtnPlay) elBtnPlay.disabled = true;

    // 播放沮喪的輸錢/棄牌音效
    if (soundLosing) {
        soundLosing.currentTime = 0;
        soundLosing.play().catch(() => {});
    }
}

/**
 * 終極封神版：點擊加注 (Play) 結算大腦 (徹底阻斷任何外部重複扣款)
 */
async function play() {
    // 防禦鎖：只有在發牌抉擇階段才允許撳加注
    if (gameState !== 'dealt') return;
    
    // 1. 加注金額嚴格等同於本注 Ante (\$1000)
    const playAmount = bets.ante;
    
    // 2. 嚴格檢查 Wallet 全域錢包餘額是否足夠
    if (totalBalance < playAmount) {
        updateMessage("❌ 餘額不足，不夠資金進行加注 (Play)！");
        return;
    }
    
    // 3. 搶先拍照備份發牌前的純淨注碼快照，供下一局重複下注
    lastRoundBets = {
        jackpot: bets.jackpot,
        pairplus: bets.pairplus,
        ante: bets.ante,
        sixcard: bets.sixcard,
        play: 0
    };
    
    // 4. 【全域有且僅有扣款一次】正式減去這一倍的加注錢 (\$47000 - \$1000 = \$46000)
    totalBalance -= playAmount;
    
    // 將加注金額正式寫入這局的數據
    bets.play = playAmount;
    
    // 精密鎖定這局最終完整的總投入成本（用於最後結算純利潤文字提示）
    const totalBetCost = bets.jackpot + bets.pairplus + bets.ante + bets.sixcard + bets.play;
    
    // 【最核心關鍵】狀態立刻切換為已結算階段！這一步配合 updateUI() 的鋼鐵防線，能瞬間在畫面上把 \$46000 死死鎖定！
    gameState = 'resolved';
    
    // 5. 立即強行更新一次 UI，這時左下角錢包會無比精準地高亮亮出 \$46000！
    updateUI();
    
    // 徹底鎖定所有控制按鈕，防止動畫期間玩家重複狂點
    if (elBtnDeal) elBtnDeal.disabled = true;
    if (elBtnFold) elBtnFold.disabled = true;
    if (elBtnPlay) elBtnPlay.disabled = true;
    if (elBtnNext) elBtnNext.disabled = true;
    if (elBtnClear) elBtnClear.disabled = true;
    if (elBtnRebet) elBtnRebet.disabled = true;
    if (elBtnDouble) elBtnDouble.disabled = true;
    
    // 6. 依次 3D 翻開莊家牌
    revealDealerCards();
    
    let playerEval = evaluate3CardHand(playerHand);
    let dealerEval = evaluate3CardHand(dealerHand);
    let summaryMessage = `你手牌：【${playerEval.name}】。莊家手牌：【${dealerEval.name}】。`;
    
    let dealerQualifies = (dealerEval.rank > HAND_RANK.HIGH_CARD) || (dealerEval.values >= 12);
    
    // 用來記錄各個投注圈【各自贏得或退回的總彩金本利和】
    let winDetails = { jackpot: 0, sixcard: 0, ante: 0, pairplus: 0, play: 0 };
    
    // 7. 計算主注勝負
    if (!dealerQualifies) {
        winDetails.ante = bets.ante * 2; 
        winDetails.play = bets.play;     
        summaryMessage += " 莊家不成局（不夠 Q）！本注獲勝，加注走牌。";
    } else {
        let result = compareHands(playerEval, dealerEval);
        if (result === 1) {
            winDetails.ante = bets.ante * 2;
            winDetails.play = bets.play * 2;
            summaryMessage += " 👍 你贏了莊家！主注雙贏！";
        } else if (result === -1) {
            summaryMessage += " 😮 莊家牌大，你輸了主注。";
        } else {
            winDetails.ante = bets.ante;
            winDetails.play = bets.play;
            summaryMessage += " 🤝 雙方平手，走牌！";
        }
    }

    // 8. 計算 Ante Bonus 額外獎賞 (算入 Ante 圈一起派發放大)
    let anteBonusWin = 0;
    if (playerEval.rank === HAND_RANK.STRAIGHT_FLUSH) anteBonusWin = bets.ante * 5;
    else if (playerEval.rank === HAND_RANK.THREE_OF_A_KIND) anteBonusWin = bets.ante * 4;
    else if (playerEval.rank === HAND_RANK.STRAIGHT) anteBonusWin = bets.ante * 1;
    
    if (anteBonusWin > 0) {
        winDetails.ante += anteBonusWin;
        summaryMessage += ` 🎖️ 額外贏得【Ante Bonus】$${anteBonusWin}！`;
    }

    // ==========================================
    // 9. 結算所有邊注 (終極安全對齊、絕對不卡死版)
    // ==========================================
    let playerEvalSide = evaluate3CardHand(playerHand);
    let sideBetSummary = ""; // 用來暫存邊注的中獎大字戰報

    // 🔵 Pair Plus 結算
    if (bets.pairplus > 0) {
        let mult = getPairPlusMultiplier(playerEvalSide.rank);
        if (mult > 0) {
            winDetails.pairplus = bets.pairplus * (mult + 1);
            sideBetSummary += ` 🔵【Pair Plus 中 ${playerEvalSide.name} 1 賠 ${mult}！】`;
        }
    }

    // 🟣 6-Card Bonus 結算 (安全修正點)
    if (bets.sixcard > 0) {
        // 1. 先呼叫你原本專案裡 100% 運作正常的舊函數，拿到它的原始倍率 (例如三條拿 7)
        let sixMult = checkSixCardBonus(); 
        
        if (sixMult > 0) {
            winDetails.sixcard = bets.sixcard * (sixMult + 1);
            
            // 2. 透過倍率，逆向精準推導出玩家中了甚麼牌型，100% 繞過函數名不對齊的死機風險！
            let rankName = "大牌";
            if (sixMult === 500) rankName = "皇家同花順";
            else if (sixMult === 100) rankName = "同花順";
            else if (sixMult === 50) rankName = "四條";
            else if (sixMult === 20) rankName = "夫盧(葫蘆)";
            else if (sixMult === 15) rankName = "同花";
            else if (sixMult === 10) rankName = "順子";
            else if (sixMult === 7) rankName = "三條";

            sideBetSummary += ` 🟣【6-Card Bonus 中 ${rankName} 1 賠 ${sixMult}！】`;
        }
    }

    // 🔴 Jackpot 結算
    if (bets.jackpot > 0) {
        let jackResult = checkJackpotBonus();
        if (jackResult.win) {
            winDetails.jackpot = jackResult.payout;
            sideBetSummary += ` 🔴【Jackpot 擊中大獎！贏得 $${jackResult.payout}】`;
        }
    }

    // 10. 將中獎或退本的投注圈，在畫面上即時數字放大、閃爍金光！
    let hasAnyWin = false;
    for (let zone in winDetails) {
        if (winDetails[zone] > 0) {
            hasAnyWin = true;
            const elChip = document.getElementById(`chip-${zone}`);
            const elZone = document.getElementById(`zone-${zone}`);
            if (elChip && elZone) {
                elChip.textContent = winDetails[zone];
                elZone.classList.add('payout-glow');
            }
        }
    }

    // 計算純利潤用於戰報提示
    const totalReturnedFromCasino = winDetails.ante + winDetails.play + winDetails.jackpot + winDetails.sixcard + winDetails.pairplus;
    const netProfit = totalReturnedFromCasino - totalBetCost;

    // 將剛剛算好的邊注倍率大字，無縫插入到主戰報的後方！
    if (sideBetSummary !== "") {
        summaryMessage += sideBetSummary;
    }

    if (netProfit > 0) {
        summaryMessage += ` ✨ 🎉【本局淨贏得: $${netProfit}】🎉`;
        if (soundWinning) { soundWinning.currentTime = 0; soundWinning.play().catch(() => {}); }
    } else if (netProfit < 0) {
        summaryMessage += ` ❌【本局淨輸掉: $${Math.abs(netProfit)}】`;
        if (soundLosing) { soundLosing.currentTime = 0; soundLosing.play().catch(() => {}); }
    } else {
        summaryMessage += ` 🤝【本局完全平手，無輸無贏】`;
        if (soundDraw) { soundDraw.currentTime = 0; soundDraw.play().catch(() => {}); }
    }
    updateMessage(summaryMessage);

    // ==========================================
    // 💡 流水線定格：【停頓 1.2 秒】，讓玩家看清各圈贏多少！
    // ==========================================
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 11. 【吸金大法】點對點引爆流星飛向錢包動畫
    if (hasAnyWin) {
        const walletElement = document.querySelector('.player-wallet');
        for (let zone in winDetails) {
            if (winDetails[zone] > 0) {
                const elZone = document.getElementById(`zone-${zone}`);
                if (elZone && walletElement) {
                    animateChipFly(elZone, walletElement, winDetails[zone]);
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 750));
    }

    // 12. 【大結局：全域資產一次性精密撥款】
    // 動畫放完之後，才正式把拿回來的總本利和加回全域錢包！
    totalBalance += totalReturnedFromCasino;
    
    // 【核心大優化】清空下注圈金額前，我們先把 gameState 暫時改回 'betting'，
    // 這樣 zeroAllBets() 後 updateUI() 才能把四個圈圈乾淨抹除成 0
    gameState = 'betting';
    zeroAllBets();
    
    // 徹底刷新大腦 UI，此時 bets 為 0，錢包數字會百分之百完美亮出最終結算總額！
    updateUI();
    
    // 演完後，重新把 gameState 鎖回 'resolved'，並只安全解鎖開啟「下一局」按鈕
    gameState = 'resolved';
    if (elBtnNext) elBtnNext.disabled = false;
    if (elBtnClear) elBtnClear.disabled = true; // 亮牌結算階段，禁止清空或換籌碼
}

/**
 * 點對點動態生成籌碼並飛向錢包的黑科技函數
 */
function animateChipFly(fromZone, toWallet, amountText) {
    // 1. 獲取起始落注圈和終點錢包在手機/電腦螢幕上的【絕對生體座標 (BoundingClientRect)】
    const fromRect = fromZone.getBoundingClientRect();
    const toRect = toWallet.getBoundingClientRect();
    
    // 2. 在起始圈的中央，動態無中生有創立一顆 HTML 黃金籌碼
    const flyer = document.createElement('div');
    flyer.className = 'flying-chip-element';
    flyer.textContent = amountText;
    
    // 定位在起始落注圈的中心點
    flyer.style.left = `${fromRect.left + (fromRect.width / 2) - 16}px`;
    flyer.style.top = `${fromRect.top + (fromRect.height / 2) - 16}px`;
    
    document.body.appendChild(flyer);
    
    // 3. 計算點對點的精確 X 和 Y 軸位移位差差距
    const diffX = (toRect.left + (toRect.width / 2)) - (fromRect.left + (fromRect.width / 2));
    const diffY = (toRect.top + (toRect.height / 2)) - (fromRect.top + (fromRect.height / 2));
    
    // 4. 延時 20ms 啟動 transition，讓籌碼帶有弧度地暴射向左下角的錢包！
    setTimeout(() => {
        flyer.style.transform = `translate(${diffX}px, ${diffY}px) scale(0.6)`;
        flyer.style.opacity = '0.3';
    }, 20);
    
    // 5. 當 700ms 籌碼精準鑽進錢包內部的一瞬間
    setTimeout(() => {
        // 移除飛行的籌碼
        flyer.remove();
        
        // 播放震撼的收錢吸金撞擊聲！
        if (soundCoin) {
            soundCoin.currentTime = 0;
            soundCoin.play().catch(() => {});
        }
        
        // 讓左下角的 WALLET 盒子觸發金色震動高亮彈跳，營造吸金視覺！
        toWallet.classList.add('wallet-absorb');
        setTimeout(() => {
            toWallet.classList.remove('wallet-absorb');
        }, 300);
        
    }, 700);
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

/**
 * 結算時，依次序優雅地翻開莊家的三張牌 (3D 翻牌修正版)
 */
function revealDealerCards() {
    const dealerContainer = document.getElementById('dealer-cards');
    dealerContainer.innerHTML = '';
    
    // 先把這三張牌的面朝下結構渲染出來
    const cardElements = [];
    dealerHand.forEach(card => {
        const el = renderCard(card, dealerContainer, false);
        cardElements.push(el);
    });
    
    // 每隔 200 毫秒，依次為這三張牌加上 .flipped
    cardElements.forEach((el, index) => {
        setTimeout(() => {
            el.classList.add('flipped');
            
            // 【神級優化】莊家依次掀牌時，同樣強制跳過前奏空白，做到 100% 視覺與聽覺同步！
            soundCard.currentTime = 0.15; // ※ 這裡的秒數要與上面 renderCard 保持完全一致
            soundCard.play().catch(() => {});
        }, index * 200);
    });
}

/**
 * 終極清洗：確保這局完結時，檯面上所有的數字完全被乾淨抹除，不殘留到下一局
 */
function zeroAllBets() {
    bets.jackpot = 0;
    bets.pairplus = 0;
    bets.ante = 0;
    bets.play = 0;
    bets.sixcard = 0;
    // ⚠️ 歷史記憶 lastRoundBets 絕對不可以在這裡清空！
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
 * 將檯面上的所有牌面清空，恢復成 3張莊家、2張公牌、3張玩家的「3D 蓋牌」背面模樣
 */
function resetCardsToBack() {
    // 重置莊家牌背
    const dContainer = document.getElementById('dealer-cards');
    dContainer.innerHTML = '<div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div>';
    
    // 重置公牌牌背
    const cContainer = document.getElementById('community-cards');
    cContainer.innerHTML = '<div class="card card-community"><div class="card-inner"><div class="card-back"></div></div></div><div class="card card-community"><div class="card-inner"><div class="card-back"></div></div></div>';
    
    // 重置玩家牌背
    const pContainer = document.getElementById('player-cards');
    pContainer.innerHTML = '<div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div>';
    
    // 進入全新下注階段
    gameState = 'betting';
    elBtnNext.disabled = true; // 蓋牌後禁用下一局按鈕
    // 【核心修正】強行在收牌進入新局的一瞬間，將檯面清空並徹底重刷 UI 觸發大腦開鎖！
    zeroAllBets(); 
    updateMessage("請放入本注（Ante）開始遊戲");
    updateUI();
    
    // 恢復目前預設的面額籌碼重新高亮彈起
    const defaultChip = document.querySelector(`.chip-${selectedChipValue}`);
    if (defaultChip) {
        defaultChip.classList.add('active-chip');
    }
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

// ==========================================
// 14. 隱藏版大富豪後門 (Cheat Code)
// ==========================================
const elCheatTrigger = document.getElementById('cheat-trigger');

if (elCheatTrigger) {
    elCheatTrigger.addEventListener('click', () => {
        // 1. 玩家資產即時暴增 50 萬！
        totalBalance += 500000;
        
        // 2. 即時刷新畫面的 UI (令左下角錢包數字即時飆升)
        updateUI();
        
        // 3. 戰報訊息即時調侃提示 (增加 Debug 趣味性)
        updateMessage("🤫 ✨【神級後門已啟動：成功注入 $500,000 賭本！】✨");
        
        // 4. 觸發左下角黑金 WALLET 錢包的金色膨脹彈跳特效！
        const walletElement = document.querySelector('.player-wallet');
        if (walletElement) {
            walletElement.classList.add('wallet-absorb');
            setTimeout(() => {
                walletElement.classList.remove('wallet-absorb');
            }, 300);
        }
        
        // 5. 同步響起清脆無比的黃金碼吸金碰撞聲！
        if (soundCoin) {
            soundCoin.currentTime = 0;
            soundCoin.play().catch(() => {});
        }
    });
}

// ==========================================
// 15. 重複下注 (Rebet) 與 加倍下注 (Double) 核心大腦邏輯
// ==========================================
/**
 * 執行「重複下注」：複製上一局的所有注碼（已修正解鎖機制）
 */
function executeRebet() {
    // 【核心修正】如果目前是上局結算亮牌階段 (resolved)，點擊重複下注時自動觸發收牌重置新局！
    if (gameState === 'resolved') {
        resetCardsToBack(); // 這一步會把牌收回，並將 gameState 自動變回 'betting'
    }

    // 防禦鎖：確保目前經已安全進入下注階段，且有上一局的拍照快照
    if (gameState !== 'betting' || !lastRoundBets) return;
    
    // 1. 計算上一局的總注碼花費
    const totalCost = lastRoundBets.ante + lastRoundBets.pairplus + lastRoundBets.sixcard + lastRoundBets.jackpot;
    
    // 2. 檢查錢包夠不夠錢一鍵複製
    if (totalBalance < totalCost) {
        updateMessage("❌ 錢包餘額不足，不夠資金完全複製上一局的注碼！");
        return;
    }
    
    // 3. 扣錢並完美複製
    totalBalance -= totalCost;
    bets.ante = lastRoundBets.ante;
    bets.pairplus = lastRoundBets.pairplus;
    bets.sixcard = lastRoundBets.sixcard;
    bets.jackpot = lastRoundBets.jackpot;
    
    // 4. 響起清脆的落注籌碼撞擊聲
    if (soundChip) {
        soundChip.currentTime = 0;
        soundChip.play().catch(() => {});
    }
    
    updateMessage("🔄 經已成功複製並放入上一局的所有注碼！");
    updateUI();
}

/**
 * 執行「加倍下注」：將當前檯面上的所有注碼翻倍 (X2)
 */
function executeDouble() {
    // 加倍只能在真正的下注中階段執行
    if (gameState !== 'betting') return;
    
    // 1. 計算再加碼一倍需要額外掏出多少錢
    const extraCost = bets.ante + bets.pairplus + bets.sixcard + bets.jackpot;
    
    // 2. 檢查錢包夠不夠錢翻倍
    if (totalBalance < extraCost) {
        updateMessage("❌ 錢包餘額不足，不夠資金將目前的注碼翻倍！");
        return;
    }
    
    // 3. 扣錢並翻倍
    totalBalance -= extraCost;
    bets.ante *= 2;
    bets.pairplus *= 2;
    bets.sixcard *= 2;
    bets.jackpot *= 2;
    
    // 4. 響起清脆的籌碼聲
    if (soundChip) {
        soundChip.currentTime = 0;
        soundChip.play().catch(() => {});
    }
    
    updateMessage("💰 檯面注碼經已成功全部翻倍（Double）！");
    updateUI();
}

// 確保按鈕監聽器完全與按鈕綁定 (防禦重複綁定)
if (elBtnRebet) {
    elBtnRebet.removeEventListener('click', executeRebet);
    elBtnRebet.addEventListener('click', executeRebet);
}
if (elBtnDouble) {
    elBtnDouble.removeEventListener('click', executeDouble);
    elBtnDouble.addEventListener('click', executeDouble);
}

// ==========================================
// 💡 終極防禦：確保按鈕事件有且僅有單一綁定，絕不允許重複觸發！
// ==========================================
if (elBtnDeal) {
    elBtnDeal.removeEventListener('click', dealCards);
    elBtnDeal.addEventListener('click', dealCards);
}

if (elBtnPlay) {
    elBtnPlay.removeEventListener('click', play);
    elBtnPlay.addEventListener('click', play);
}

if (elBtnFold) {
    elBtnFold.removeEventListener('click', fold);
    elBtnFold.addEventListener('click', fold);
}

if (elBtnNext) {
    elBtnNext.removeEventListener('click', resetCardsToBack);
    elBtnNext.addEventListener('click', resetCardsToBack);
}

/**
 * 執行「換荷官」：重新切換牌組，並隨機重軋玩家幸運值 (50 至 118)
 */
function executeChangeDealer() {
    if (gameState !== 'betting' && gameState !== 'resolved') return;
    
    if (gameState === 'resolved') {
        resetCardsToBack();
    }
    
    // 1. 徹底打碎舊牌，重新建立一整套 100% 全新的 52 張標準啤牌
    createDeck();
    shuffleDeck();
    
    playerHand = [];
    dealerHand = [];
    communityHand = [];
    
    // 2. 【核心大腦注入】一鍵重軋幸運值！精密計算使其在 50 至 118 之間隨機波動
    // Math.random() * (118 - 50 + 1) + 50 ➡️ 確保完美覆蓋 50 到 118 的所有整數
    currentLuckFactor = Math.floor(Math.random() * (118 - 50 + 1)) + 50;
    
    // 3. 重置發牌 HTML 容器為初始紅牌背外觀
    const pContainer = document.getElementById('player-cards');
    const dContainer = document.getElementById('dealer-cards');
    const cContainer = document.getElementById('community-cards');
    if (pContainer) pContainer.innerHTML = '<div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div>';
    if (dContainer) dContainer.innerHTML = '<div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div><div class="card"><div class="card-inner"><div class="card-back"></div></div></div>';
    if (cContainer) cContainer.innerHTML = '<div class="card card-community"><div class="card-inner"><div class="card-back"></div></div></div><div class="card card-community"><div class="card-inner"><div class="card-back"></div></div></div>';

    // 4. 響起紙牌高頻摩擦洗牌聲
    if (soundCard) {
        soundCard.currentTime = 0.15;
        soundCard.play().catch(() => {});
    }
    
    // 提示大字 (我特意幫你在戰報戰況裡「悄悄印出這個值」，方便你現在即時 Debug 測試，你隨後可以自行決定拿走)
    updateMessage(`🔮【新荷官經已優雅就位】！全牌組重新洗牌完成。 祝你本局手風大順！`);
    updateUI();
}

// 唯一性事件綁定
if (elBtnChangeDealer) {
    elBtnChangeDealer.removeEventListener('click', executeChangeDealer);
    elBtnChangeDealer.addEventListener('click', executeChangeDealer);
}

// ==========================================
// 16. 幸運值「一擊加10、上限188」隱藏調校外掛 (Cheat Code)
// ==========================================
const elModalLuckClick = document.getElementById('modal-luck-value');

if (elModalLuckClick) {
    elModalLuckClick.addEventListener('click', () => {
        // 1. 【核心修正】每次點擊，幸運值直接原地拔高 10 點！
        currentLuckFactor += 10;
        
        // 2. 【核心修正】嚴格鎖定上限：只要超過 188，就死死鎖定、截斷在 188！
        if (currentLuckFactor > 188) {
            currentLuckFactor = 188;
            updateMessage("👑 【氣運已達極致！】荷官幸運值已鎖定在最高天堂 188 分！");
        } else {
            updateMessage(`🔮 【氣運操控成功】荷官幸運值已手動調校提升至: ${currentLuckFactor}`);
        }
        
        // 3. 即時刷新 UI，讓數字在彈窗裡立刻跳變，並自動根據高低觸發綠、紅、金氣氛燈！
        updateUI();
        
        // 4. 同步響起落注籌碼碰撞聲，增加操控手感！
        if (soundChip) {
            soundChip.currentTime = 0;
            soundChip.play().catch(() => {});
        }
        
        // 5. 順便讓左下角的 WALLET 錢包高亮彈跳一下，營造後門對接感
        const walletElement = document.querySelector('.player-wallet');
        if (walletElement) {
            walletElement.classList.add('wallet-absorb');
            setTimeout(() => {
                walletElement.classList.remove('wallet-absorb');
            }, 300);
        }
    });
}
