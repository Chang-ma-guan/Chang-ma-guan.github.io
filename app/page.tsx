"use client";

import { useState } from "react";

const lessons = [
  {
    id: "tiles",
    step: "01",
    title: "先讀懂手裡的牌",
    description: "從萬、筒、索到風牌與三元牌，用最短的時間建立完整牌感。",
    progress: "約 8 分鐘",
    tiles: ["🀇", "🀈", "🀉", "🀙", "🀚", "🀛"],
  },
  {
    id: "shape",
    step: "02",
    title: "看見牌型的輪廓",
    description: "學會拆搭子、留進張，知道哪些牌該留、哪些牌可以放心打。",
    progress: "約 12 分鐘",
    tiles: ["🀐", "🀑", "🀒", "🀔", "🀕", "🀗"],
  },
  {
    id: "table",
    step: "03",
    title: "第一次自在上桌",
    description: "掌握台數、流程與桌上禮儀，從容完成你的第一將。",
    progress: "約 10 分鐘",
    tiles: ["🀀", "🀁", "🀂", "🀃", "🀄", "🀅"],
  },
];

const tickerTiles = ["🀇", "🀈", "🀉", "🀐", "🀑", "🀒", "🀙", "🀚", "🀛", "🀀", "🀄", "🀅"];

export default function Home() {
  const [activeLesson, setActiveLesson] = useState(0);
  const [answerVisible, setAnswerVisible] = useState(false);
  const lesson = lessons[activeLesson];

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="開桌首頁">
          <span className="brand-mark">開</span>
          <span>開桌</span>
        </a>
        <nav aria-label="主要導覽">
          <a href="#learn">入門學堂</a>
          <a href="#challenge">每日一手</a>
          <a href="#about">關於開桌</a>
        </nav>
        <a className="header-cta" href="#learn">開始學牌 <span aria-hidden="true">↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> 台灣麻將入門誌</p>
          <h1>把每一手，<br />打得更明白。</h1>
          <p className="hero-intro">
            麻將不只是運氣。從看懂牌、判斷進張，到真正坐上牌桌——我們把複雜的規則，整理成剛剛好的第一步。
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#learn">從零開始學 <span aria-hidden="true">→</span></a>
            <a className="text-link" href="#challenge">先試一手 <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-meta" aria-label="課程特色">
            <div><strong>16</strong><span>張台灣玩法</span></div>
            <div><strong>30</strong><span>分鐘學會入門</span></div>
            <div><strong>0</strong><span>艱深術語</span></div>
          </div>
        </div>

        <div className="hero-table" aria-label="東風牌桌情境插圖">
          <div className="table-ring ring-one" />
          <div className="table-ring ring-two" />
          <span className="seat north">北</span>
          <span className="seat east">東</span>
          <span className="seat south">南</span>
          <span className="seat west">西</span>
          <div className="hero-tile-shadow" />
          <div className="hero-tile">
            <span>🀅</span>
          </div>
          <div className="floating-note note-one"><span>01</span> 看懂牌</div>
          <div className="floating-note note-two"><span>02</span> 拆搭子</div>
          <div className="floating-note note-three"><span>03</span> 上桌去</div>
          <p className="table-caption">EAST WIND · ROUND 01</p>
        </div>
      </section>

      <div className="tile-marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...tickerTiles, ...tickerTiles].map((tile, index) => (
            <span key={`${tile}-${index}`}>{tile}</span>
          ))}
        </div>
      </div>

      <section className="manifesto" id="about">
        <p className="section-kicker">不是背規則，是理解選擇</p>
        <div className="manifesto-copy">
          <h2>會打，從「為什麼」開始。</h2>
          <p>
            我們相信，麻將最迷人的地方不在死背牌型，而是每一次取捨。開桌用清楚的圖解與短練習，陪你建立自己的判斷。
          </p>
        </div>
        <div className="seal" aria-hidden="true"><span>開桌</span><small>KAIZHUO</small></div>
      </section>

      <section className="learning" id="learn">
        <div className="section-heading">
          <div>
            <p className="section-kicker light">新手路線</p>
            <h2>三步，坐上牌桌。</h2>
          </div>
          <p>不用一次記住全部。跟著節奏走，今天就能完成第一局。</p>
        </div>

        <div className="lesson-layout">
          <div className="lesson-list" role="tablist" aria-label="新手課程">
            {lessons.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeLesson === index}
                aria-controls="lesson-panel"
                className={activeLesson === index ? "lesson-button active" : "lesson-button"}
                onClick={() => setActiveLesson(index)}
              >
                <span className="lesson-number">{item.step}</span>
                <span className="lesson-label"><strong>{item.title}</strong><small>{item.progress}</small></span>
                <span className="lesson-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>

          <article className="lesson-panel" id="lesson-panel" role="tabpanel">
            <div className="lesson-panel-top">
              <span>LESSON {lesson.step}</span>
              <span>{lesson.progress}</span>
            </div>
            <div className="lesson-tiles" aria-label="本課示例牌">
              {lesson.tiles.map((tile, index) => <span key={`${tile}-${index}`}>{tile}</span>)}
            </div>
            <h3>{lesson.title}</h3>
            <p>{lesson.description}</p>
            <button className="lesson-start" type="button">開始這一課 <span aria-hidden="true">↗</span></button>
          </article>
        </div>
      </section>

      <section className="challenge" id="challenge">
        <div className="challenge-copy">
          <p className="section-kicker">每日一手 · #028</p>
          <h2>這手牌，<br />你在等什麼？</h2>
          <p>先別急著算台。看一眼牌型，找出所有可以胡牌的進張。</p>
          <div className="difficulty"><span>難度</span><i /><i /><i className="muted" /><i className="muted" /></div>
        </div>

        <div className="challenge-card">
          <div className="challenge-head">
            <span>你的手牌</span>
            <span>東風圈 · 門清</span>
          </div>
          <div className="hand" aria-label="一萬二萬三萬、二筒三筒四筒、六索七索八索、東東、九筒九筒">
            {["🀇", "🀈", "🀉", "🀚", "🀛", "🀜", "🀕", "🀖", "🀗", "🀀", "🀀", "🀡", "🀡"].map((tile, index) => (
              <span key={`${tile}-${index}`}>{tile}</span>
            ))}
          </div>
          <div className={answerVisible ? "answer revealed" : "answer"} aria-live="polite">
            {answerVisible ? (
              <>
                <div className="answer-tiles"><span>🀀</span><span>🀡</span></div>
                <div><strong>等東風或九筒</strong><p>兩組對子都可能成刻子，留下另一組作將眼。</p></div>
              </>
            ) : (
              <p>答案藏在這裡。想好了嗎？</p>
            )}
          </div>
          <button type="button" className="reveal-button" onClick={() => setAnswerVisible((visible) => !visible)}>
            {answerVisible ? "收起答案" : "揭曉答案"} <span aria-hidden="true">{answerVisible ? "↑" : "→"}</span>
          </button>
        </div>
      </section>

      <section className="details">
        <div className="detail-card detail-green">
          <span className="detail-index">01</span>
          <div className="mini-table" aria-hidden="true"><span>碰</span></div>
          <h3>一眼看懂</h3>
          <p>用牌桌視角解釋規則，少一點文字，多一點真正看得懂。</p>
        </div>
        <div className="detail-card detail-cream">
          <span className="detail-index">02</span>
          <div className="pattern" aria-hidden="true">🀄 🀄 🀄</div>
          <h3>短短練習</h3>
          <p>每課只練一個觀念，等車、喝咖啡的時間就能完成。</p>
        </div>
        <div className="detail-card detail-red">
          <span className="detail-index">03</span>
          <div className="score-mark" aria-hidden="true"><strong>8</strong><span>台</span></div>
          <h3>台灣玩法</h3>
          <p>以 16 張麻將為主，從常見牌型到台數一次整理清楚。</p>
        </div>
      </section>

      <section className="closing">
        <div className="closing-tile" aria-hidden="true">🀄</div>
        <p className="section-kicker light">下一張牌，等你來摸</p>
        <h2>準備好，開桌了嗎？</h2>
        <p>從第一課開始。三十分鐘後，你會比想像中更懂麻將。</p>
        <a className="closing-button" href="#learn">免費開始學 <span aria-hidden="true">→</span></a>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">開</span><span>開桌</span></a>
        <p>把每一手，打得更明白。</p>
        <div><a href="#learn">入門學堂</a><a href="#challenge">每日一手</a><a href="#about">關於</a></div>
        <small>© 2026 開桌 KAIZHUO</small>
      </footer>
    </main>
  );
}
