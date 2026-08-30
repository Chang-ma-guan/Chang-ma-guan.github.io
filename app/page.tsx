import { type FocusEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addPlayerRecord,
  createRoom,
  deleteFundAdjustment,
  deleteFundExpense,
  deleteGameRecord,
  ensureGuestAuth,
  enterRoom,
  forgetSavedRoom,
  getSavedRoomId,
  removePlayerRecord,
  restoreRoom,
  saveFundAdjustment,
  saveFundExpense,
  saveGameRecord,
  setCurrentSeasonRecord,
  setOpeningBalanceRecord,
  updatePlayerRecord,
  watchLedger,
  type GameResult,
  type GameSession,
  type FundAdjustment,
  type FundExpense,
  type LedgerData,
  type Player,
} from "./firebase";
type SeatInput = { playerId: string; amount: string; wins: string; selfDraws: string; dealsIn: string };
type View = "overview" | "records" | "players" | "fund";
type PlayerStats = {
  player: Player;
  games: number;
  decisiveGames: number;
  rounds: number;
  winningGames: number;
  losingGames: number;
  grossWin: number;
  grossLoss: number;
  net: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  average: number;
  averagePerRound: number;
  best: number;
  worst: number;
  selfDraws: number;
  selfDrawsPerGame: number;
  dealsIn: number;
  dealsInPerGame: number;
  recentNet: number;
  streak: string;
};

const playerColors = ["#167c5a", "#e6533f", "#e7ae35", "#5266bd", "#bd477b", "#6b7280", "#1297aa", "#8660aa"];
const emptyData: LedgerData = { players: [], sessions: [], results: [], expenses: [], adjustments: [], currentSeason: "本季", openingBalance: 0 };

function today() { return new Date().toISOString().slice(0, 10); }
function freshSeats(): SeatInput[] {
  return Array.from({ length: 4 }, () => ({ playerId: "", amount: "", wins: "0", selfDraws: "", dealsIn: "" }));
}
function formatMoney(value: number, showPlus = true) {
  const sign = value > 0 && showPlus ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("zh-TW")}`;
}
function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}
function percentage(value: number) { return `${Math.round(value)}%`; }
function decimal(value: number) { return value.toFixed(1); }
function selectNumber(event: FocusEvent<HTMLInputElement>) { event.currentTarget.select(); }
function streakLabel(amounts: number[]) {
  if (!amounts.length) return "—";
  const positive = amounts[0] >= 0;
  let count = 0;
  for (const amount of amounts) {
    if ((positive && amount >= 0) || (!positive && amount < 0)) count += 1;
    else break;
  }
  return `${positive ? "連勝" : "連敗"} ${count} 場`;
}
function firstCharacter(value: string) { return Array.from(value.trim())[0] ?? ""; }
function playerAvatar(player: Pick<Player, "name" | "avatar">) {
  return firstCharacter(player.avatar) || firstCharacter(player.name) || "?";
}
function tiedLeaders(rows: PlayerStats[], score: (row: PlayerStats) => number, lowest = false) {
  if (!rows.length) return [];
  const target = (lowest ? Math.min : Math.max)(...rows.map(score));
  return rows.filter((row) => Math.abs(score(row) - target) < 0.000001);
}

export default function Home() {
  const [data, setData] = useState<LedgerData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>("overview");
  const [season, setSeason] = useState("全部賽季");
  const seasonInitialized = useRef(false);
  const [focusPlayer, setFocusPlayer] = useState("all");
  const [recordOpen, setRecordOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [fundToolsOpen, setFundToolsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [playedAt, setPlayedAt] = useState(today());
  const [recordSeason, setRecordSeason] = useState("本季");
  const [rounds, setRounds] = useState("1");
  const [note, setNote] = useState("");
  const [seats, setSeats] = useState<SeatInput[]>(freshSeats());
  const [newPlayer, setNewPlayer] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [newColor, setNewColor] = useState(playerColors[0]);

  useEffect(() => {
    let alive = true;
    void ensureGuestAuth().then(async () => {
      const saved = getSavedRoomId();
      const restored = saved ? await restoreRoom(saved) : null;
      if (alive) setRoomId(restored);
    }).catch((error) => {
      if (alive) setAccessError(error instanceof Error ? error.message : "連線失敗，請稍後再試");
    }).finally(() => {
      if (alive) setAccessLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    return watchLedger(roomId, (next) => {
      setData(next);
      if (!seasonInitialized.current) {
        setSeason(next.currentSeason || "本季");
        seasonInitialized.current = true;
      }
      setLoading(false);
      setMessage("");
    }, (error) => {
      setLoading(false);
      setMessage(error);
    });
  }, [roomId]);

  const seasons = useMemo(() => Array.from(new Set([data.currentSeason, ...data.sessions.map((item) => item.season), ...data.expenses.map((item) => item.season), ...data.adjustments.map((item) => item.season)].filter(Boolean))), [data.adjustments, data.currentSeason, data.expenses, data.sessions]);
  const filteredSessions = useMemo(() => data.sessions.filter((item) => season === "全部賽季" || item.season === season), [data.sessions, season]);
  const filteredSessionIds = useMemo(() => new Set(filteredSessions.map((item) => item.id)), [filteredSessions]);
  const filteredResults = useMemo(() => data.results.filter((item) => filteredSessionIds.has(item.sessionId)), [data.results, filteredSessionIds]);
  const filteredExpenses = useMemo(() => data.expenses.filter((item) => season === "全部賽季" || item.season === season), [data.expenses, season]);
  const filteredAdjustments = useMemo(() => data.adjustments.filter((item) => season === "全部賽季" || item.season === season), [data.adjustments, season]);

  const stats = useMemo(() => {
    const roundsBySession = new Map(filteredSessions.map((session) => [session.id, session.rounds]));
    return data.players.map((player): PlayerStats => {
      const entries = filteredResults.filter((item) => item.playerId === player.id);
      const orderedEntries = filteredSessions.map((session) => entries.find((entry) => entry.sessionId === session.id)).filter((entry): entry is GameResult => Boolean(entry));
      const amounts = entries.map((item) => item.amount);
      const net = amounts.reduce((sum, amount) => sum + amount, 0);
      const winningGames = amounts.filter((amount) => amount >= 0).length;
      const losingGames = amounts.filter((amount) => amount < 0).length;
      const grossWin = amounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);
      const grossLoss = Math.abs(amounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0));
      const decisiveGames = winningGames + losingGames;
      const rounds = entries.reduce((sum, item) => sum + (roundsBySession.get(item.sessionId) ?? 0), 0);
      const selfDraws = entries.reduce((sum, item) => sum + item.selfDraws, 0);
      const dealsIn = entries.reduce((sum, item) => sum + item.dealsIn, 0);
      return {
        player,
        games: entries.length,
        decisiveGames,
        rounds,
        winningGames,
        losingGames,
        grossWin,
        grossLoss,
        net,
        winRate: decisiveGames ? (winningGames / decisiveGames) * 100 : 0,
        averageWin: winningGames ? Math.round(grossWin / winningGames) : 0,
        averageLoss: losingGames ? Math.round(grossLoss / losingGames) : 0,
        average: entries.length ? Math.round(net / entries.length) : 0,
        averagePerRound: rounds ? Math.round(net / rounds) : 0,
        best: amounts.length ? Math.max(...amounts) : 0,
        worst: amounts.length ? Math.min(...amounts) : 0,
        selfDraws,
        selfDrawsPerGame: decisiveGames ? selfDraws / decisiveGames : 0,
        dealsIn,
        dealsInPerGame: decisiveGames ? dealsIn / decisiveGames : 0,
        recentNet: orderedEntries.slice(0, 5).reduce((sum, item) => sum + item.amount, 0),
        streak: streakLabel(orderedEntries.map((item) => item.amount)),
      };
    }).filter((item) => item.games > 0 || item.player.active).sort((a, b) => b.net - a.net);
  }, [data.players, filteredResults, filteredSessions]);

  const focused = focusPlayer === "all" ? null : stats.find((item) => item.player.id === focusPlayer) ?? null;
  const fundIncome = filteredResults.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const fundSpending = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const fundAdjustment = filteredAdjustments.reduce((sum, item) => sum + item.amount, 0);
  const fundBalance = fundIncome - fundSpending + fundAdjustment + (season === "全部賽季" ? data.openingBalance : 0);
  const allTimeFundIncome = data.results.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const allTimeFundSpending = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  const allTimeFundAdjustment = data.adjustments.reduce((sum, item) => sum + item.amount, 0);
  const allTimeFundBalance = data.openingBalance + allTimeFundIncome - allTimeFundSpending + allTimeFundAdjustment;
  const leader = stats.find((item) => item.games > 0);
  const dealsInKings = tiedLeaders(stats.filter((item) => item.dealsIn > 0), (item) => Number(item.dealsInPerGame.toFixed(1)));
  const selfDrawKings = tiedLeaders(stats.filter((item) => item.selfDraws > 0), (item) => Number(item.selfDrawsPerGame.toFixed(1)));
  const killers = tiedLeaders(stats.filter((item) => item.grossWin > 0), (item) => item.averageWin);
  const comfortProviders = tiedLeaders(stats.filter((item) => item.losingGames > 0), (item) => item.averageLoss);
  const shareholders = tiedLeaders(stats.filter((item) => item.grossLoss > 0), (item) => item.grossLoss);
  const activeStats = stats.filter((item) => item.player.active);
  const soulPlayers = tiedLeaders(activeStats, (item) => item.games);
  const timidPlayers = tiedLeaders(activeStats, (item) => item.games, true);
  const brightestAmount = Math.max(0, ...filteredResults.map((item) => item.amount));
  const brightestResults = brightestAmount > 0 ? filteredResults.filter((item) => item.amount === brightestAmount) : [];
  const brightestPlayerIds = new Set(brightestResults.map((item) => item.playerId));
  const brightestPlayers = data.players.filter((item) => brightestPlayerIds.has(item.id));
  const brightestSession = brightestResults.length === 1 ? filteredSessions.find((item) => item.id === brightestResults[0].sessionId) : null;
  const overviewAwards = [
    { title: "放槍王", mark: "槍", players: dealsInKings.map((item) => item.player), value: dealsInKings.length ? `${decimal(dealsInKings[0].dealsInPerGame)} 次` : "—", hint: "平均放槍數最高" },
    { title: "自摸王", mark: "摸", players: selfDrawKings.map((item) => item.player), value: selfDrawKings.length ? `${decimal(selfDrawKings[0].selfDrawsPerGame)} 次` : "—", hint: "平均自摸數最高" },
    { title: "殺王", mark: "殺", players: killers.map((item) => item.player), value: killers.length ? formatMoney(killers[0].averageWin, false) : "—", hint: "平均單場贏最多" },
    { title: "有你就舒服", mark: "舒", players: comfortProviders.map((item) => item.player), value: comfortProviders.length ? `-$${comfortProviders[0].averageLoss.toLocaleString("zh-TW")}` : "—", hint: "平均單場輸最多" },
    { title: "大股東", mark: "股", players: shareholders.map((item) => item.player), value: shareholders.length ? `-$${shareholders[0].grossLoss.toLocaleString("zh-TW")}` : "—", hint: "輸錢總額／繳基金最多" },
    { title: "張家靈魂人物", mark: "靈", players: soulPlayers.map((item) => item.player), value: soulPlayers.length ? `${soulPlayers[0].games} 場` : "—", hint: "參與場次最多" },
    { title: "小孬孬", mark: "孬", players: timidPlayers.map((item) => item.player), value: timidPlayers.length ? `${timidPlayers[0].games} 場` : "—", hint: "參與場次最少" },
    { title: "本季最耀眼", mark: "耀", players: brightestPlayers, value: brightestAmount ? formatMoney(brightestAmount) : "—", hint: brightestSession ? `${formatDate(brightestSession.playedAt)} 單場最高` : brightestPlayers.length > 1 ? "多人並列單場最高" : brightestResults.length > 1 ? "多場並列單場最高" : "等待第一場勝局" },
  ];
  const maxBar = Math.max(1, ...stats.map((item) => Math.abs(item.net)));
  const allParticipations = stats.reduce((sum, item) => sum + item.games, 0);
  const ringBackground = stats.length
    ? `conic-gradient(${stats.map((item, index) => {
        const start = stats.slice(0, index).reduce((sum, row) => sum + row.games, 0) / Math.max(1, allParticipations) * 100;
        const end = start + item.games / Math.max(1, allParticipations) * 100;
        return `${item.player.color} ${start}% ${end}%`;
      }).join(", ")})`
    : "#e5e8e2";
  const detailFacts = focused ? [
    { label: "贏錢場次", value: `${focused.winningGames} 場`, tone: "money-up" },
    { label: "贏錢總額", value: formatMoney(focused.grossWin, false), tone: "money-up" },
    { label: "輸錢場次", value: `${focused.losingGames} 場`, tone: "money-down" },
    { label: "輸錢總額", value: focused.grossLoss ? `-$${focused.grossLoss.toLocaleString("zh-TW")}` : "$0", tone: focused.grossLoss ? "money-down" : "" },
    { label: "勝率", value: percentage(focused.winRate) },
    { label: "平均單場贏", value: formatMoney(focused.averageWin, false), tone: "money-up" },
    { label: "平均單場輸", value: focused.averageLoss ? `-$${focused.averageLoss.toLocaleString("zh-TW")}` : "$0", tone: focused.averageLoss ? "money-down" : "" },
    { label: "平均自摸數", value: `${decimal(focused.selfDrawsPerGame)} 次` },
    { label: "平均放槍數", value: `${decimal(focused.dealsInPerGame)} 次` },
  ] : [];

  const resetRecordForm = useCallback(() => {
    setEditingId(null);
    setPlayedAt(today());
    setRecordSeason(data.currentSeason || "本季");
    setRounds("1");
    setNote("");
    setSeats(freshSeats());
    setMessage("");
  }, [data.currentSeason]);

  function openNewRecord() {
    resetRecordForm();
    if (data.players.filter((player) => player.active).length < 4) {
      setPlayersOpen(true);
      setMessage("請先建立至少 4 位成員，再新增對局。");
      return;
    }
    setRecordOpen(true);
  }

  function editRecord(session: GameSession) {
    const rows = data.results.filter((result) => result.sessionId === session.id).sort((a, b) => a.placement - b.placement);
    setEditingId(session.id);
    setPlayedAt(session.playedAt);
    setRecordSeason(session.season);
    setRounds(String(session.rounds));
    setNote(session.note);
    setSeats(rows.map((row) => ({ playerId: row.playerId, amount: String(row.amount), wins: String(row.wins), selfDraws: row.selfDraws ? String(row.selfDraws) : "", dealsIn: row.dealsIn ? String(row.dealsIn) : "" })));
    setMessage("");
    setRecordOpen(true);
  }

  const amountValues = seats.map((item) => Number(item.amount));
  const balance = amountValues.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const recordValid = seats.length === 4 && seats.every((item) => item.playerId && item.amount.trim() !== "") && amountValues.every(Number.isInteger) && new Set(seats.map((item) => item.playerId)).size === 4 && balance === 0;

  async function openRoom(code: string, creating: boolean) {
    setAccessSaving(true);
    setAccessError("");
    try {
      const nextRoom = creating ? await createRoom(code) : await enterRoom(code);
      setRoomId(nextRoom);
      setLoading(true);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "無法進入張麻館");
    } finally {
      setAccessSaving(false);
    }
  }

  function switchRoom() {
    forgetSavedRoom();
    setRoomId(null);
    setData(emptyData);
    setSeason("全部賽季");
    seasonInitialized.current = false;
    setAccessError("");
  }

  async function submitRecord(event: FormEvent) {
    event.preventDefault();
    if (!recordValid || !roomId) return;
    setSaving(true);
    try {
      await saveGameRecord(roomId, { id: editingId, playedAt, season: recordSeason, rounds: Number(rounds), note, results: seats.map((seat) => ({ ...seat, amount: Number(seat.amount), wins: Number(seat.wins), selfDraws: Number(seat.selfDraws), dealsIn: Number(seat.dealsIn) })) });
      setRecordOpen(false);
      setMessage(editingId ? "紀錄已更新。" : "新對局已記下來。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally { setSaving(false); }
  }

  async function deleteRecord(id: string) {
    if (!roomId || !window.confirm("確定要刪除這筆對局嗎？刪除後無法復原。")) return;
    try {
      await deleteGameRecord(roomId, id);
      setMessage("紀錄已刪除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除失敗");
    }
  }

  async function changeCurrentSeason(nextSeason: string) {
    if (!roomId) return;
    await setCurrentSeasonRecord(roomId, nextSeason, data.openingBalance);
    setSeason(nextSeason.trim());
    setRecordSeason(nextSeason.trim());
    setSeasonOpen(false);
    setMessage(`已換成「${nextSeason.trim()}」，之後新增的對局會自動放在這一季。`);
  }

  async function addExpense(input: { spentAt: string; season: string; amount: number; note: string }) {
    if (!roomId) return;
    await saveFundExpense(roomId, input);
    setExpenseOpen(false);
    setMessage(`已從張家麻將基金扣除 ${formatMoney(input.amount, false)}。`);
  }

  async function removeExpense(expense: FundExpense) {
    if (!roomId || !window.confirm(`確定刪除「${expense.note || "旅遊支出"}」${formatMoney(expense.amount, false)} 嗎？`)) return;
    try {
      await deleteFundExpense(roomId, expense.id);
      setMessage("基金支出紀錄已刪除，餘額已重新計算。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除支出失敗");
    }
  }

  async function updateOpeningBalance(value: number) {
    if (!roomId) return;
    await setOpeningBalanceRecord(roomId, data.currentSeason, value);
    setFundToolsOpen(false);
    setMessage(`已將歷年結轉餘額設為 ${formatMoney(value)}。`);
  }

  async function addAdjustment(input: { adjustedAt: string; season: string; amount: number; note: string; kind: "manual" | "reconciliation"; balanceAfter: number | null }) {
    if (!roomId) return;
    await saveFundAdjustment(roomId, input);
    setFundToolsOpen(false);
    setMessage(input.kind === "reconciliation" ? `對帳完成，基金帳面餘額已調整為 ${formatMoney(input.balanceAfter ?? 0)}。` : `帳務調整 ${formatMoney(input.amount)} 已記錄。`);
  }

  async function removeAdjustment(adjustment: FundAdjustment) {
    if (!roomId || !window.confirm(`確定刪除這筆帳務調整 ${formatMoney(adjustment.amount)} 嗎？`)) return;
    try {
      await deleteFundAdjustment(roomId, adjustment.id);
      setMessage("帳務調整已刪除，基金餘額已重新計算。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除調整失敗");
    }
  }

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    if (!newPlayer.trim() || !roomId) return;
    try {
      await addPlayerRecord(roomId, { name: newPlayer, avatar: newAvatar, color: newColor });
      setNewPlayer("");
      setNewAvatar("");
      setNewColor(playerColors[(data.players.length + 1) % playerColors.length]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增失敗");
    }
  }

  async function updatePlayer(player: Player) {
    if (!roomId) return;
    try {
      await updatePlayerRecord(roomId, player);
      setMessage("成員資料已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
      throw error;
    }
  }

  async function removePlayer(player: Player) {
    if (!roomId || !window.confirm(`確定要移除「${player.name}」嗎？已有紀錄的成員會改為停用，不會影響過去統計。`)) return;
    try {
      await removePlayerRecord(roomId, player);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "移除失敗");
    }
  }

  function exportCsv() {
    const header = ["日期", "賽季", "成員", "輸贏金額", "名次", "自摸", "放槍", "將數", "備註"];
    const rows = data.sessions.flatMap((session) => data.results.filter((result) => result.sessionId === session.id).map((result) => {
      const player = data.players.find((item) => item.id === result.playerId);
      return [session.playedAt, session.season, player?.name ?? "", result.amount, result.placement, result.selfDraws, result.dealsIn, session.rounds, session.note];
    }));
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `張麻館-${today()}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const navigation: { id: View; label: string; icon: string }[] = [
    { id: "overview", label: "總覽", icon: "發" },
    { id: "records", label: "對局紀錄", icon: "萬" },
    { id: "players", label: "成員統計", icon: "筒" },
    { id: "fund", label: "麻將基金", icon: "中" },
  ];
  const viewHeading = {
    overview: { copy: "家庭戰況一目了然", title: "本季戰況" },
    records: { copy: "每一場都清清楚楚", title: "對局紀錄" },
    players: { copy: "看看誰是牌桌常勝軍", title: "成員統計" },
    fund: { copy: "輸家繳錢，旅遊花用", title: "張家麻將基金" },
  }[view];
  const viewTiles = {
    overview: ["東", "發", "中"],
    records: ["萬", "筒", "索"],
    players: ["南", "西", "北"],
    fund: ["發", "中", "白"],
  }[view];

  if (accessLoading) return <AccessLoading />;
  if (!roomId) return <AccessGate error={accessError} saving={accessSaving} onSubmit={openRoom} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="app-brand"><span>張</span><div><strong>張麻館</strong><small>FAMILY MAHJONG</small></div></div>
        <nav className="side-nav" aria-label="主要選單">
          {navigation.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={view === item.id ? "active" : ""}><i>{item.icon}</i><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-tiles" aria-hidden="true"><span>東</span><span>南</span><span>西</span><span>北</span></div>
          <button type="button" onClick={() => setPlayersOpen(true)}>管理成員 <span>→</span></button>
          <button type="button" onClick={switchRoom}>更換通關碼 <span>↗</span></button>
          <p>家人的共用麻將帳本</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><span>張</span><strong>張麻館</strong></div>
          <label className="season-select"><span>統計區間</span><select value={season} onChange={(event) => { if (event.target.value === "__new_season__") setSeasonOpen(true); else setSeason(event.target.value); }}><option>全部賽季</option>{seasons.map((item) => <option key={item} value={item}>{item}{item === data.currentSeason ? "（目前）" : ""}</option>)}<option value="__new_season__">＋ 開始新一季…</option></select></label>
          <div className="top-actions"><button className="room-button" type="button" onClick={switchRoom}>換館</button><button className="export-button" type="button" onClick={exportCsv} disabled={!data.sessions.length}>↓ 匯出 Excel</button><button className="add-button" type="button" onClick={openNewRecord}><span>＋</span> 記一局</button></div>
        </header>

        <div className="content">
          {message && <div className="toast" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")}>×</button></div>}

          <div className="page-heading">
            <div><p>{viewHeading.copy}</p><h1>{viewHeading.title}</h1></div>
            <div className="heading-actions"><div className="heading-tiles" aria-hidden="true">{viewTiles.map((tile, index) => <span className={`tile-${index + 1}`} key={`${view}-${tile}`}>{tile}</span>)}</div>{(view === "overview" || view === "players") && <label className="player-filter">查看誰<select value={focusPlayer} onChange={(event) => setFocusPlayer(event.target.value)}><option value="all">全體成員</option>{data.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}</div>
          </div>

          {loading ? <LoadingState /> : data.players.length < 4 ? (
            <EmptyOnboarding onOpen={() => setPlayersOpen(true)} />
          ) : view === "overview" ? (
            <>
              <section className={focused ? "metric-grid" : "metric-grid overview-metric-grid"} aria-label="主要統計">
                <Metric tile={focused ? "中" : "萬"} label={focused ? `${focused.player.name} 淨輸贏` : "總對局數"} value={focused ? formatMoney(focused.net) : `${filteredSessions.length}`} unit={focused ? "" : "場"} tone={focused && focused.net < 0 ? "red" : "green"} hint={focused ? `${focused.games} 場紀錄` : `${season} · ${data.players.filter((player) => player.active).length} 位成員`} />
                <Metric tile="發" label={focused ? "勝率" : "本季手氣王"} value={focused ? percentage(focused.winRate) : leader?.player.name ?? "—"} unit="" tone="dark" hint={focused ? `贏錢 ${focused.winningGames} 場／輸錢 ${focused.losingGames} 場` : leader ? formatMoney(leader.net) : "還沒有對局"} />
                {focused && <Metric tile="筒" label="平均每場" value={formatMoney(focused.average)} unit="" tone="cream" hint={`單場最佳 ${formatMoney(focused.best)}`} />}
                {focused && <Metric tile="索" label="自摸 / 放槍" value={`${focused.selfDraws} / ${focused.dealsIn}`} unit="次" tone="yellow" hint={`平均 ${decimal(focused.selfDrawsPerGame)}／${decimal(focused.dealsInPerGame)} 次`} />}
              </section>
              {detailFacts.length > 0 && <section className="quick-stat-grid" aria-label={`${focused?.player.name ?? "成員"}詳細統計`}>
                {detailFacts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong className={fact.tone}>{fact.value}</strong></article>)}
              </section>}

              <section className="award-panel" aria-label="牌桌風雲榜">
                <div className="award-heading"><div><span>TABLE TITLES</span><h2>牌桌風雲榜</h2></div><p>依目前選擇的統計區間計算</p></div>
                <div className="award-grid">{overviewAwards.map((award, awardIndex) => <article className={`${award.title === "本季最耀眼" ? "award-card featured" : "award-card"} award-style-${awardIndex % 4}`} key={award.title}>
                  <span className="award-mark" style={{ color: award.players[0]?.color ?? "#7e8c85" }}>{award.mark}</span>
                  <div className="award-copy"><small>{award.title}</small>{award.players.length ? <div className="award-winners">{award.players.map((player) => <span key={player.id}><i style={{ background: player.color }}>{playerAvatar(player)}</i>{player.name}</span>)}</div> : <strong>尚無資料</strong>}<p>{award.hint}{award.players.length > 1 ? ` · ${award.players.length} 人並列` : ""}</p></div>
                  <b>{award.value}</b>
                </article>)}</div>
              </section>

              <section className="dashboard-grid">
                <article className="panel leaderboard-panel">
                  <PanelHead eyebrow="RANKING" title="輸贏排行榜" action="完整統計" onAction={() => setView("players")} />
                  <div className="leaderboard">
                    {stats.length ? stats.slice(0, 8).map((row, index) => <div className="rank-row" key={row.player.id}>
                      <span className={`rank-number rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
                      <span className="player-dot" style={{ background: row.player.color }}>{playerAvatar(row.player)}</span>
                      <div className="rank-name"><strong>{row.player.name}</strong><small>{row.games} 場 · 勝率 {percentage(row.winRate)}</small></div>
                      <div className="rank-bar"><span className={row.net >= 0 ? "positive" : "negative"} style={{ width: `${Math.max(5, Math.abs(row.net) / maxBar * 100)}%` }} /></div>
                      <strong className={row.net >= 0 ? "money-up" : "money-down"}>{formatMoney(row.net)}</strong>
                    </div>) : <EmptyMini text="記下第一場後，排行榜就會出現在這裡。" />}
                  </div>
                </article>

                <article className="panel participation-panel">
                  <PanelHead eyebrow="ATTENDANCE" title="參與占比" />
                  {stats.some((item) => item.games) ? <><div className="donut" style={{ background: ringBackground }}><div><strong>{filteredSessions.length}</strong><span>場對局</span></div></div><div className="donut-legend">{stats.map((row) => <div key={row.player.id}><span style={{ background: row.player.color }} /><strong>{row.player.name}</strong><small>{Math.round(row.games / Math.max(1, allParticipations) * 100)}%</small></div>)}</div></> : <EmptyMini text="目前還沒有參與資料。" />}
                </article>
              </section>

              <RecentRecords sessions={filteredSessions.slice(0, 5)} results={data.results} players={data.players} onEdit={editRecord} onDelete={deleteRecord} onMore={() => setView("records")} />
            </>
          ) : view === "records" ? (
            <RecordsView sessions={filteredSessions} results={data.results} players={data.players} onEdit={editRecord} onDelete={deleteRecord} onAdd={openNewRecord} />
          ) : view === "players" ? (
            <PlayersView stats={stats} maxBar={maxBar} onManage={() => setPlayersOpen(true)} />
          ) : (
            <FundPanel season={season} currentSeason={data.currentSeason} openingBalance={data.openingBalance} income={fundIncome} spending={fundSpending} adjustment={fundAdjustment} balance={fundBalance} allTimeBalance={allTimeFundBalance} stats={stats} expenses={filteredExpenses} adjustments={filteredAdjustments} onChangeSeason={() => setSeasonOpen(true)} onAddExpense={() => setExpenseOpen(true)} onOpenFundTools={() => setFundToolsOpen(true)} onDeleteExpense={removeExpense} onDeleteAdjustment={removeAdjustment} />
          )}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="手機選單">{navigation.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={view === item.id ? "active" : ""}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>

      {recordOpen && <RecordModal editing={Boolean(editingId)} players={data.players} seasons={seasons} playedAt={playedAt} setPlayedAt={setPlayedAt} season={recordSeason} setSeason={setRecordSeason} rounds={rounds} setRounds={setRounds} note={note} setNote={setNote} seats={seats} setSeats={setSeats} balance={balance} valid={recordValid} saving={saving} onClose={() => setRecordOpen(false)} onSubmit={submitRecord} />}
      {playersOpen && <PlayersModal players={data.players} newPlayer={newPlayer} setNewPlayer={setNewPlayer} newAvatar={newAvatar} setNewAvatar={setNewAvatar} newColor={newColor} setNewColor={setNewColor} onAdd={addPlayer} onUpdate={updatePlayer} onRemove={removePlayer} onClose={() => { setPlayersOpen(false); setMessage(""); }} />}
      {seasonOpen && <SeasonModal currentSeason={data.currentSeason} seasons={seasons} onClose={() => setSeasonOpen(false)} onSave={changeCurrentSeason} />}
      {expenseOpen && <ExpenseModal currentSeason={data.currentSeason} seasons={seasons} onClose={() => setExpenseOpen(false)} onSave={addExpense} />}
      {fundToolsOpen && <FundToolsModal currentSeason={data.currentSeason} seasons={seasons} openingBalance={data.openingBalance} bookBalance={allTimeFundBalance} onClose={() => setFundToolsOpen(false)} onSaveOpening={updateOpeningBalance} onSaveAdjustment={addAdjustment} />}
    </main>
  );
}

function AccessLoading() {
  return <main className="access-shell"><div className="access-card loading-access"><div className="brand-tile">張</div><p>正在連接張麻館…</p></div></main>;
}

function AccessGate({ error, saving, onSubmit }: { error: string; saving: boolean; onSubmit: (code: string, creating: boolean) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSubmit(code, creating);
  }

  return <main className="access-shell">
    <section className="access-card">
      <div className="access-brand"><div className="brand-tile">張</div><div><p>FAMILY MAHJONG</p><h1>張麻館</h1></div></div>
      <div className="mahjong-winds" aria-hidden="true"><span>東</span><span>南</span><span>西</span><span>北</span></div>
      <div className="access-copy"><p>{creating ? "第一次開館" : "家人專用入口"}</p><h2>{creating ? "設定一組家庭通關碼" : "輸入家庭通關碼"}</h2><span>{creating ? "至少 8 個字元，請記下來並只分享給家人。" : "同一台手機成功進入後，下次不必重新輸入。"}</span></div>
      <form className="access-form" onSubmit={submit}>
        <label>家庭通關碼<input type="password" value={code} onChange={(event) => setCode(event.target.value)} minLength={8} autoComplete={creating ? "new-password" : "current-password"} placeholder="至少 8 個字元" required /></label>
        {error && <p className="access-error" role="alert">{error}</p>}
        <button className="access-primary" type="submit" disabled={saving || code.trim().length < 8}>{saving ? "連線中…" : creating ? "建立張麻館" : "進入張麻館"}</button>
      </form>
      <button className="access-switch" type="button" onClick={() => setCreating((value) => !value)}>{creating ? "已經建立過？回到登入" : "第一次使用？建立張麻館"}</button>
      <p className="access-note">通關碼不會被儲存；資料使用張麻館專屬的 Firebase 免費資料庫。</p>
    </section>
  </main>;
}

function Metric({ tile, label, value, unit, tone, hint }: { tile: string; label: string; value: string; unit: string; tone: string; hint: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-label"><span>{label}</span><i>{tile}</i></div><div className="metric-value"><strong>{value}</strong>{unit && <span>{unit}</span>}</div><p>{hint}</p></article>;
}

function PanelHead({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  const tile = title.includes("排行榜") ? "萬" : title.includes("參與") ? "筒" : title.includes("最近") ? "東" : "發";
  return <header className="panel-head"><div className="panel-title"><i aria-hidden="true">{tile}</i><div><span>{eyebrow}</span><h2>{title}</h2></div></div>{action && <button type="button" onClick={onAction}>{action} →</button>}</header>;
}

function EmptyMini({ text }: { text: string }) { return <div className="empty-mini"><span>🀄</span><p>{text}</p></div>; }

function LoadingState() { return <div className="loading-state"><i /><i /><i /><p>正在打開帳本…</p></div>; }

function EmptyOnboarding({ onOpen }: { onOpen: () => void }) {
  return <section className="onboarding"><div className="onboarding-art"><span>東</span><span>南</span><span>西</span><span>北</span></div><p>從你的家人名單開始</p><h2>先建立至少 4 位成員</h2><p className="onboarding-copy">建立好成員後，就能記錄每場輸贏、自摸與放槍，所有統計會自動完成。</p><button type="button" onClick={onOpen}>＋ 新增家庭成員</button></section>;
}

function RecentRecords({ sessions, results, players, onEdit, onDelete, onMore }: { sessions: GameSession[]; results: GameResult[]; players: Player[]; onEdit: (session: GameSession) => void; onDelete: (id: string) => void; onMore: () => void }) {
  return <article className="panel records-panel"><PanelHead eyebrow="RECENT GAMES" title="最近對局" action="查看全部" onAction={onMore} />{sessions.length ? <RecordTable sessions={sessions} results={results} players={players} onEdit={onEdit} onDelete={onDelete} /> : <EmptyMini text="還沒有對局紀錄，按右上角「記一局」開始。" />}</article>;
}

function RecordsView({ sessions, results, players, onEdit, onDelete, onAdd }: { sessions: GameSession[]; results: GameResult[]; players: Player[]; onEdit: (session: GameSession) => void; onDelete: (id: string) => void; onAdd: () => void }) {
  return <article className="panel records-panel full"><PanelHead eyebrow="LEDGER" title={`${sessions.length} 場對局`} action="＋ 新增紀錄" onAction={onAdd} />{sessions.length ? <RecordTable sessions={sessions} results={results} players={players} onEdit={onEdit} onDelete={onDelete} /> : <EmptyMini text="這個區間還沒有紀錄。" />}</article>;
}

function RecordTable({ sessions, results, players, onEdit, onDelete }: { sessions: GameSession[]; results: GameResult[]; players: Player[]; onEdit: (session: GameSession) => void; onDelete: (id: string) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>日期 / 賽季</th><th>本場輸贏</th><th>將數</th><th>備註</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{sessions.map((session) => {
    const rows = results.filter((result) => result.sessionId === session.id).sort((a, b) => b.amount - a.amount);
    return <tr key={session.id}><td><strong>{formatDate(session.playedAt)}</strong><small>{session.season}</small></td><td><div className="result-pills">{rows.map((row) => { const player = players.find((item) => item.id === row.playerId); return <span key={row.id}><i style={{ background: player?.color }} />{player?.name}<b className={row.amount >= 0 ? "money-up" : "money-down"}>{formatMoney(row.amount)}</b></span>; })}</div></td><td>{session.rounds} 將</td><td className="note-cell">{session.note || "—"}</td><td><div className="row-actions"><button type="button" onClick={() => onEdit(session)}>編輯</button><button type="button" className="delete" onClick={() => onDelete(session.id)}>刪除</button></div></td></tr>;
  })}</tbody></table></div>;
}

function PlayersView({ stats, maxBar, onManage }: { stats: PlayerStats[]; maxBar: number; onManage: () => void }) {
  const comparisonRows: { label: string; value: (row: PlayerStats) => string; tone?: (row: PlayerStats) => string }[] = [
    { label: "淨輸贏", value: (row) => formatMoney(row.net), tone: (row) => row.net >= 0 ? "money-up" : "money-down" },
    { label: "贏錢場次", value: (row) => `${row.winningGames} 場` },
    { label: "贏錢總額", value: (row) => formatMoney(row.grossWin, false), tone: () => "money-up" },
    { label: "輸錢場次", value: (row) => `${row.losingGames} 場` },
    { label: "輸錢總額", value: (row) => row.grossLoss ? `-$${row.grossLoss.toLocaleString("zh-TW")}` : "$0", tone: (row) => row.grossLoss ? "money-down" : "" },
    { label: "勝率", value: (row) => percentage(row.winRate) },
    { label: "平均單場贏", value: (row) => formatMoney(row.averageWin, false), tone: () => "money-up" },
    { label: "平均單場輸", value: (row) => row.averageLoss ? `-$${row.averageLoss.toLocaleString("zh-TW")}` : "$0", tone: (row) => row.averageLoss ? "money-down" : "" },
    { label: "平均自摸數", value: (row) => decimal(row.selfDrawsPerGame) },
    { label: "平均放槍數", value: (row) => decimal(row.dealsInPerGame) },
    { label: "平均每場", value: (row) => formatMoney(row.average) },
    { label: "平均每將", value: (row) => formatMoney(row.averagePerRound) },
    { label: "最佳 / 最差", value: (row) => `${formatMoney(row.best)} / ${formatMoney(row.worst)}` },
    { label: "場數 / 將數", value: (row) => `${row.games} 場 / ${row.rounds} 將` },
    { label: "自摸 / 放槍總數", value: (row) => `${row.selfDraws} / ${row.dealsIn}` },
    { label: "近五場", value: (row) => formatMoney(row.recentNet), tone: (row) => row.recentNet >= 0 ? "money-up" : "money-down" },
    { label: "目前近況", value: (row) => row.streak },
  ];

  return <>
    <div className="players-view-head"><p>金額為 0 也算勝場；勝率與所有平均皆以勝場加輸場計算。</p><button type="button" onClick={onManage}>管理成員 →</button></div>
    <section className="player-card-grid">{stats.map((row, index) => <article className="player-stat-card" key={row.player.id}>
      <header><span className="player-avatar" style={{ background: row.player.color }}>{playerAvatar(row.player)}</span><div><small>RANK {String(index + 1).padStart(2, "0")}</small><h2>{row.player.name}</h2></div><strong className={row.net >= 0 ? "money-up" : "money-down"}>{formatMoney(row.net)}</strong></header>
      <div className="player-main-bar"><i className={row.net >= 0 ? "positive" : "negative"} style={{ width: `${Math.max(4, Math.abs(row.net) / maxBar * 100)}%` }} /></div>
      <dl>
        <div><dt>參戰</dt><dd>{row.games} 場 / {row.rounds} 將</dd></div>
        <div><dt>贏錢場次</dt><dd>{row.winningGames} 場</dd></div>
        <div><dt>輸錢場次</dt><dd>{row.losingGames} 場</dd></div>
        <div><dt>勝率</dt><dd>{percentage(row.winRate)}</dd></div>
        <div><dt>贏錢總額</dt><dd className="money-up">{formatMoney(row.grossWin, false)}</dd></div>
        <div><dt>輸錢總額</dt><dd className={row.grossLoss ? "money-down" : ""}>{row.grossLoss ? `-$${row.grossLoss.toLocaleString("zh-TW")}` : "$0"}</dd></div>
        <div><dt>平均單場贏</dt><dd className="money-up">{formatMoney(row.averageWin, false)}</dd></div>
        <div><dt>平均單場輸</dt><dd className={row.averageLoss ? "money-down" : ""}>{row.averageLoss ? `-$${row.averageLoss.toLocaleString("zh-TW")}` : "$0"}</dd></div>
        <div><dt>平均自摸數</dt><dd>{decimal(row.selfDrawsPerGame)}</dd></div>
        <div><dt>平均放槍數</dt><dd>{decimal(row.dealsInPerGame)}</dd></div>
        <div><dt>平均每場</dt><dd>{formatMoney(row.average)}</dd></div>
        <div><dt>平均每將</dt><dd>{formatMoney(row.averagePerRound)}</dd></div>
        <div><dt>最佳單場</dt><dd className={row.best >= 0 ? "money-up" : "money-down"}>{formatMoney(row.best)}</dd></div>
        <div><dt>最差單場</dt><dd className={row.worst >= 0 ? "money-up" : "money-down"}>{formatMoney(row.worst)}</dd></div>
        <div><dt>自摸總數</dt><dd>{row.selfDraws}</dd></div>
        <div><dt>放槍總數</dt><dd>{row.dealsIn}</dd></div>
        <div><dt>近五場</dt><dd className={row.recentNet >= 0 ? "money-up" : "money-down"}>{formatMoney(row.recentNet)}</dd></div>
        <div><dt>目前近況</dt><dd>{row.streak}</dd></div>
      </dl>
    </article>)}{!stats.length && <EmptyMini text="新增對局後會顯示成員統計。" />}</section>
    {stats.length > 0 && <article className="panel stats-comparison-panel">
      <PanelHead eyebrow="FULL STATISTICS" title="成員數據總表" />
      <div className="stats-comparison-wrap"><table className="stats-comparison" style={{ minWidth: `${Math.max(760, 150 + stats.length * 128)}px` }}>
        <thead><tr><th>統計項目</th>{stats.map((row) => <th key={row.player.id}><span className="compare-player"><i style={{ background: row.player.color }}>{playerAvatar(row.player)}</i>{row.player.name}</span></th>)}</tr></thead>
        <tbody>{comparisonRows.map((item) => <tr key={item.label}><th>{item.label}</th>{stats.map((row) => <td className={item.tone?.(row)} key={row.player.id}>{item.value(row)}</td>)}</tr>)}</tbody>
      </table></div>
    </article>}
  </>;
}

function FundPanel({ season, currentSeason, openingBalance, income, spending, adjustment, balance, allTimeBalance, stats, expenses, adjustments, onChangeSeason, onAddExpense, onOpenFundTools, onDeleteExpense, onDeleteAdjustment }: {
  season: string;
  currentSeason: string;
  openingBalance: number;
  income: number;
  spending: number;
  adjustment: number;
  balance: number;
  allTimeBalance: number;
  stats: PlayerStats[];
  expenses: FundExpense[];
  adjustments: FundAdjustment[];
  onChangeSeason: () => void;
  onAddExpense: () => void;
  onOpenFundTools: () => void;
  onDeleteExpense: (expense: FundExpense) => Promise<void>;
  onDeleteAdjustment: (adjustment: FundAdjustment) => Promise<void>;
}) {
  const periodName = season === "全部賽季" ? "全部賽季" : season;
  const shareholders = [...stats].filter((row) => row.grossLoss > 0).sort((a, b) => b.grossLoss - a.grossLoss);
  const shareholderTotal = shareholders.reduce((sum, row) => sum + row.grossLoss, 0);
  const shareholderSlices = shareholders.map((row, index) => {
    const start = shareholders.slice(0, index).reduce((sum, item) => sum + item.grossLoss, 0) / shareholderTotal * 100;
    const share = row.grossLoss / shareholderTotal * 100;
    return { row, start, end: start + share, share };
  });
  const shareholderPie = shareholderSlices.length
    ? `conic-gradient(${shareholderSlices.map(({ row, start, end }) => `${row.player.color} ${start}% ${end}%`).join(", ")})`
    : "#e4e9e5";
  return <section className="fund-panel" aria-label="張家麻將基金">
    <header className="fund-head"><div><span>CHANG FAMILY FUND</span><h2>張家麻將基金</h2><p>輸家繳入、贏家不領，旅遊支出直接從基金扣除。</p></div><div className="fund-actions"><button type="button" onClick={onChangeSeason}>換季</button><button type="button" onClick={onOpenFundTools}>對帳／調整</button><button className="fund-add" type="button" onClick={onAddExpense}>＋ 記旅遊支出</button></div></header>
    <div className="fund-summary">
      <article><span>歷年結轉餘額</span><strong>{formatMoney(openingBalance)}</strong><small>網站啟用前的舊基金</small></article>
      <article><span>{periodName}基金收入</span><strong className="money-up">{formatMoney(income, false)}</strong><small>所有輸家繳入</small></article>
      <article><span>{periodName}旅遊支出</span><strong className={spending ? "money-down" : ""}>{spending ? `-$${spending.toLocaleString("zh-TW")}` : "$0"}</strong><small>已登記的支出</small></article>
      <article><span>{periodName}帳務調整</span><strong className={adjustment >= 0 ? "money-up" : "money-down"}>{formatMoney(adjustment)}</strong><small>補入或扣除的差額</small></article>
      <article><span>{periodName}結餘</span><strong className={balance >= 0 ? "money-up" : "money-down"}>{formatMoney(balance)}</strong><small>收入扣除支出</small></article>
      <article className="fund-balance"><span>基金目前總餘額</span><strong className={allTimeBalance >= 0 ? "money-up" : "money-down"}>{formatMoney(allTimeBalance)}</strong><small>全部賽季累計</small></article>
    </div>
    <div className="shareholder-panel">
      <div className="shareholder-title"><div><span>FUND SHAREHOLDERS</span><h3>股東圓餅圖</h3></div><small>{periodName}・依每個人輸錢總額計算</small></div>
      {shareholders.length ? <div className="shareholder-chart">
        <div className="shareholder-pie" style={{ background: shareholderPie }} role="img" aria-label={`${periodName}股東投入比例`}>
          {shareholderSlices.map(({ row, start, end, share }) => {
            const angle = (start + end) / 2 * 3.6 - 90;
            const radius = share < 7 ? 43 : 39;
            const radians = angle * Math.PI / 180;
            return <span className="shareholder-pie-label" style={{ left: `${50 + Math.cos(radians) * radius}%`, top: `${50 + Math.sin(radians) * radius}%` }} key={row.player.id}>{row.player.name}</span>;
          })}
          <div><strong>{formatMoney(shareholderTotal, false)}</strong><span>股東總投入</span></div>
        </div>
        <div className="shareholder-legend">{shareholders.map((row, index) => <div key={row.player.id}>
          <span className="shareholder-rank">{String(index + 1).padStart(2, "0")}</span>
          <i style={{ background: row.player.color }}>{playerAvatar(row.player)}</i>
          <strong>{row.player.name}</strong>
          <small>{formatMoney(row.grossLoss, false)}</small>
          <b>{(row.grossLoss / shareholderTotal * 100).toFixed(1)}%</b>
        </div>)}</div>
      </div> : <p className="expense-empty">目前還沒有輸錢紀錄，記下對局後就會顯示股東占比。</p>}
    </div>
    <div className="expense-history"><div className="expense-title"><div><span>TRAVEL EXPENSES</span><h3>旅遊支出紀錄</h3></div><small>目前賽季：{currentSeason}</small></div>
      {expenses.length ? <div className="expense-list">{expenses.slice(0, 8).map((expense) => <div key={expense.id}><time>{formatDate(expense.spentAt)}</time><span className="expense-season">{expense.season}</span><strong>{expense.note || "旅遊支出"}</strong><b>-${expense.amount.toLocaleString("zh-TW")}</b><button type="button" onClick={() => void onDeleteExpense(expense)}>刪除</button></div>)}</div> : <p className="expense-empty">這個統計區間還沒有旅遊支出。</p>}
    </div>
    <div className="expense-history adjustment-history"><div className="expense-title"><div><span>ACCOUNT ADJUSTMENTS</span><h3>對帳與調整紀錄</h3></div><small>所有差額都有紀錄，可隨時刪除重算</small></div>
      {adjustments.length ? <div className="expense-list">{adjustments.slice(0, 8).map((item) => <div key={item.id}><time>{formatDate(item.adjustedAt)}</time><span className="expense-season">{item.season}</span><strong>{item.note || (item.kind === "reconciliation" ? "帳戶對帳" : "帳務調整")}{item.balanceAfter !== null ? `（對帳後 ${formatMoney(item.balanceAfter)}）` : ""}</strong><b className={item.amount >= 0 ? "money-up" : "money-down"}>{formatMoney(item.amount)}</b><button type="button" onClick={() => void onDeleteAdjustment(item)}>刪除</button></div>)}</div> : <p className="expense-empty">目前沒有帳務調整。</p>}
    </div>
  </section>;
}

function SeasonModal({ currentSeason, seasons, onClose, onSave }: { currentSeason: string; seasons: string[]; onClose: () => void; onSave: (season: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [savingSeason, setSavingSeason] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setSavingSeason(true);
    setError("");
    try { await onSave(value); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "換季失敗"); setSavingSeason(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="season-title"><header className="modal-head"><div><p>NEW SEASON</p><h2 id="season-title">開始新一季</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header><form onSubmit={submit}>
    <div className="current-season-note"><span>目前賽季</span><strong>{currentSeason}</strong></div>
    <label className="modal-field">新賽季名稱<input list="existing-season-options" value={value} onChange={(event) => setValue(event.target.value)} placeholder="例如：第十季" maxLength={24} required /><datalist id="existing-season-options">{seasons.map((item) => <option key={item} value={item} />)}</datalist></label>
    <p className="form-help">換季不會清除舊資料；之後新增對局和支出會自動使用新賽季。</p>
    {error && <p className="modal-error">{error}</p>}
    <footer className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="save-button" type="submit" disabled={!value.trim() || savingSeason}>{savingSeason ? "儲存中…" : "確認換季"}</button></footer>
  </form></div></div>;
}

function ExpenseModal({ currentSeason, seasons, onClose, onSave }: { currentSeason: string; seasons: string[]; onClose: () => void; onSave: (input: { spentAt: string; season: string; amount: number; note: string }) => Promise<void> }) {
  const [spentAt, setSpentAt] = useState(today());
  const [expenseSeason, setExpenseSeason] = useState(currentSeason);
  const [amount, setAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const number = Number(amount);
    if (!Number.isInteger(number) || number <= 0) { setError("請輸入正確的支出金額"); return; }
    setSavingExpense(true);
    setError("");
    try { await onSave({ spentAt, season: expenseSeason, amount: number, note: expenseNote }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "儲存支出失敗"); setSavingExpense(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal compact-modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"><header className="modal-head"><div><p>TRAVEL EXPENSE</p><h2 id="expense-title">記旅遊支出</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header><form onSubmit={submit}>
    <div className="expense-form-grid"><label className="modal-field">日期<input type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} required /></label><label className="modal-field">賽季<select value={expenseSeason} onChange={(event) => setExpenseSeason(event.target.value)}>{seasons.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <label className="modal-field">旅遊花費金額<div className="expense-money-input"><span>$</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onFocus={selectNumber} onChange={(event) => { const next = event.target.value.trim(); if (/^\d*$/.test(next)) setAmount(next); }} placeholder="0" required /></div></label>
    <label className="modal-field">用途或備註<input value={expenseNote} onChange={(event) => setExpenseNote(event.target.value)} placeholder="例如：宜蘭住宿、遊覽車" maxLength={100} /></label>
    <p className="form-help">儲存後會立刻從張家麻將基金餘額扣除。</p>
    {error && <p className="modal-error">{error}</p>}
    <footer className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="save-button" type="submit" disabled={!spentAt || !expenseSeason || !amount || savingExpense}>{savingExpense ? "儲存中…" : "扣除並儲存"}</button></footer>
  </form></div></div>;
}

function FundToolsModal({ currentSeason, seasons, openingBalance, bookBalance, onClose, onSaveOpening, onSaveAdjustment }: {
  currentSeason: string;
  seasons: string[];
  openingBalance: number;
  bookBalance: number;
  onClose: () => void;
  onSaveOpening: (value: number) => Promise<void>;
  onSaveAdjustment: (input: { adjustedAt: string; season: string; amount: number; note: string; kind: "manual" | "reconciliation"; balanceAfter: number | null }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"opening" | "manual" | "reconcile">("opening");
  const [opening, setOpening] = useState(String(openingBalance));
  const [adjustedAt, setAdjustedAt] = useState(today());
  const [adjustmentSeason, setAdjustmentSeason] = useState(currentSeason);
  const [direction, setDirection] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const [actualBalance, setActualBalance] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [savingTool, setSavingTool] = useState(false);
  const [error, setError] = useState("");
  const reconciliationDifference = actualBalance.trim() && /^-?\d+$/.test(actualBalance) ? Number(actualBalance) - bookBalance : null;
  function updateSigned(value: string, setter: (next: string) => void) { if (/^-?\d*$/.test(value.trim())) setter(value.trim()); }
  function toggleSigned(value: string, setter: (next: string) => void) { setter(value.startsWith("-") ? value.slice(1) : `-${value}`); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSavingTool(true);
    try {
      if (mode === "opening") {
        const value = Number(opening);
        if (!Number.isInteger(value)) throw new Error("請輸入正確的期初結轉餘額");
        await onSaveOpening(value);
        return;
      }
      if (mode === "manual") {
        const value = Number(amount);
        if (!Number.isInteger(value) || value <= 0) throw new Error("請輸入正確的調整金額");
        await onSaveAdjustment({ adjustedAt, season: adjustmentSeason, amount: direction === "add" ? value : -value, note: adjustmentNote, kind: "manual", balanceAfter: null });
        return;
      }
      const actual = Number(actualBalance);
      if (!Number.isInteger(actual)) throw new Error("請輸入正確的帳戶實際餘額");
      const difference = actual - bookBalance;
      if (difference === 0) throw new Error("帳戶餘額與帳面餘額已經一致，不需調整");
      await onSaveAdjustment({ adjustedAt, season: adjustmentSeason, amount: difference, note: adjustmentNote || "帳戶餘額對帳", kind: "reconciliation", balanceAfter: actual });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "儲存失敗");
      setSavingTool(false);
    }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal fund-tools-modal" role="dialog" aria-modal="true" aria-labelledby="fund-tools-title"><header className="modal-head"><div><p>FUND ACCOUNTING</p><h2 id="fund-tools-title">基金設定與對帳</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header><form onSubmit={submit}>
    <div className="fund-tool-tabs"><button className={mode === "opening" ? "active" : ""} type="button" onClick={() => { setMode("opening"); setError(""); }}>期初結轉</button><button className={mode === "manual" ? "active" : ""} type="button" onClick={() => { setMode("manual"); setError(""); }}>帳務調整</button><button className={mode === "reconcile" ? "active" : ""} type="button" onClick={() => { setMode("reconcile"); setError(""); }}>帳戶對帳</button></div>
    {mode === "opening" ? <div className="fund-tool-content"><div className="tool-explainer"><strong>以前已經結算很多季？</strong><p>把網站啟用前留下來的基金填在這裡，不用重打以前每一場。</p></div><label className="modal-field">歷年結轉餘額<div className="expense-money-input signed-input"><span>$</span><input type="text" inputMode="numeric" pattern="-?[0-9]*" value={opening} onFocus={selectNumber} onChange={(event) => updateSigned(event.target.value, setOpening)} required /><button className={opening.startsWith("-") ? "money-sign-toggle negative" : "money-sign-toggle"} type="button" onClick={() => toggleSigned(opening, setOpening)}>±</button></div></label></div> : <div className="fund-tool-content">
      <div className="expense-form-grid"><label className="modal-field">日期<input type="date" value={adjustedAt} onChange={(event) => setAdjustedAt(event.target.value)} required /></label><label className="modal-field">賽季<select value={adjustmentSeason} onChange={(event) => setAdjustmentSeason(event.target.value)}>{seasons.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      {mode === "manual" ? <><div className="direction-picker"><button className={direction === "add" ? "active add" : ""} type="button" onClick={() => setDirection("add")}>＋ 補入基金</button><button className={direction === "subtract" ? "active subtract" : ""} type="button" onClick={() => setDirection("subtract")}>－ 扣除基金</button></div><label className="modal-field">調整金額<div className="expense-money-input"><span>$</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onFocus={selectNumber} onChange={(event) => { const next = event.target.value.trim(); if (/^\d*$/.test(next)) setAmount(next); }} placeholder="0" required /></div></label></> : <><div className="reconcile-summary"><span>網站帳面餘額</span><strong>{formatMoney(bookBalance)}</strong></div><label className="modal-field">銀行帳戶目前實際餘額<div className="expense-money-input signed-input"><span>$</span><input type="text" inputMode="numeric" pattern="-?[0-9]*" value={actualBalance} onFocus={selectNumber} onChange={(event) => updateSigned(event.target.value, setActualBalance)} placeholder="請輸入實際餘額" required /><button className={actualBalance.startsWith("-") ? "money-sign-toggle negative" : "money-sign-toggle"} type="button" onClick={() => toggleSigned(actualBalance, setActualBalance)}>±</button></div></label>{reconciliationDifference !== null && <div className={`difference-preview ${reconciliationDifference >= 0 ? "positive-difference" : "negative-difference"}`}><span>系統會自動建立調整分錄</span><strong>{formatMoney(reconciliationDifference)}</strong></div>}</>}
      <label className="modal-field">調整原因（選填）<input value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} placeholder={mode === "reconcile" ? "例如：8/24 銀行帳戶對帳" : "例如：補登現金、手續費"} maxLength={100} /></label>
    </div>}
    {error && <p className="modal-error">{error}</p>}
    <footer className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="save-button" type="submit" disabled={savingTool}>{savingTool ? "儲存中…" : mode === "opening" ? "儲存結轉餘額" : mode === "manual" ? "儲存調整" : "完成對帳"}</button></footer>
  </form></div></div>;
}

function RecordModal({ editing, players, seasons, playedAt, setPlayedAt, season, setSeason, rounds, setRounds, note, setNote, seats, setSeats, balance, valid, saving, onClose, onSubmit }: {
  editing: boolean; players: Player[]; seasons: string[]; playedAt: string; setPlayedAt: (value: string) => void; season: string; setSeason: (value: string) => void; rounds: string; setRounds: (value: string) => void; note: string; setNote: (value: string) => void; seats: SeatInput[]; setSeats: (value: SeatInput[]) => void; balance: number; valid: boolean; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void;
}) {
  function updateSeat(index: number, key: keyof SeatInput, value: string) { const next = seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, [key]: value } : seat); setSeats(next); }
  function toggleAmountSign(index: number) {
    const value = seats[index].amount.trim();
    updateSeat(index, "amount", value.startsWith("-") ? value.slice(1) : `-${value}`);
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal record-modal" role="dialog" aria-modal="true" aria-labelledby="record-title"><header className="modal-head"><div><p>{editing ? "EDIT GAME" : "NEW GAME"}</p><h2 id="record-title">{editing ? "編輯對局" : "記一局"}</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header><form onSubmit={onSubmit}>
    <div className="record-basics"><label>日期<input type="date" value={playedAt} onChange={(event) => setPlayedAt(event.target.value)} required /></label><label>賽季<input list="season-options" value={season} onChange={(event) => setSeason(event.target.value)} placeholder="例如：第九季" required /><datalist id="season-options">{seasons.map((item) => <option key={item} value={item} />)}</datalist></label><label>打了幾將<input type="number" min="1" value={rounds} onFocus={selectNumber} onChange={(event) => setRounds(event.target.value)} required /></label></div>
    <div className="seat-table"><div className="seat-head"><span>成員</span><span>輸贏金額</span><span>自摸</span><span>放槍</span></div>{seats.map((seat, index) => <div className="seat-row" key={index}><span className="seat-order">{index + 1}</span><label className="seat-player"><span>成員</span><select value={seat.playerId} onChange={(event) => updateSeat(index, "playerId", event.target.value)} required><option value="">選擇</option>{players.map((player) => <option key={player.id} value={player.id} disabled={!player.active || seats.some((item, seatIndex) => seatIndex !== index && item.playerId === player.id)}>{player.name}{!player.active ? "（停用）" : ""}</option>)}</select></label><div className="seat-amount seat-field"><label htmlFor={`seat-amount-${index}`}>輸贏金額</label><div className="money-input"><i>$</i><input id={`seat-amount-${index}`} type="text" inputMode="numeric" pattern="-?[0-9]*" value={seat.amount} onFocus={selectNumber} onChange={(event) => { const value = event.target.value.trim(); if (/^-?\d*$/.test(value)) updateSeat(index, "amount", value); }} placeholder="0" required /><button className={seat.amount.startsWith("-") ? "money-sign-toggle negative" : "money-sign-toggle"} type="button" aria-label={`${players.find((player) => player.id === seat.playerId)?.name ?? `第 ${index + 1} 位`}切換金額正負號`} aria-pressed={seat.amount.startsWith("-")} onClick={() => toggleAmountSign(index)}>±</button></div></div>{(["selfDraws", "dealsIn"] as const).map((key) => <label className={`seat-stat seat-${key}`} key={key}><span>{key === "selfDraws" ? "自摸" : "放槍"}</span><input type="number" inputMode="numeric" min="0" value={seat[key]} onFocus={selectNumber} onChange={(event) => updateSeat(index, key, event.target.value)} placeholder="0" /></label>)}</div>)}</div>
    <div className={`balance-check ${balance === 0 ? "balanced" : "unbalanced"}`}><span>{balance === 0 ? "✓ 金額已平帳" : "！金額尚未平帳"}</span><strong>{balance > 0 ? "+" : ""}{formatMoney(balance, false)}</strong></div>
    <label className="note-input">備註（選填）<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：過年東風場、阿姨家" /></label>
    <footer className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="save-button" type="submit" disabled={!valid || saving}>{saving ? "儲存中…" : editing ? "儲存修改" : "存入帳本"}</button></footer>
  </form></div></div>;
}

function PlayersModal({ players, newPlayer, setNewPlayer, newAvatar, setNewAvatar, newColor, setNewColor, onAdd, onUpdate, onRemove, onClose }: {
  players: Player[]; newPlayer: string; setNewPlayer: (value: string) => void; newAvatar: string; setNewAvatar: (value: string) => void; newColor: string; setNewColor: (value: string) => void; onAdd: (event: FormEvent) => void; onUpdate: (player: Player) => Promise<void>; onRemove: (player: Player) => void; onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Player>>(() => Object.fromEntries(players.map((player) => [player.id, { ...player }])));
  const [savingPlayers, setSavingPlayers] = useState(false);
  const [saveError, setSaveError] = useState("");
  const editablePlayers = players.map((player) => drafts[player.id] ?? player);

  function patchDraft(id: string, patch: Partial<Player>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? players.find((player) => player.id === id)!), ...patch } }));
  }

  async function saveAndClose() {
    setSavingPlayers(true);
    setSaveError("");
    try {
      const changed = editablePlayers.filter((player) => {
        const saved = players.find((item) => item.id === player.id);
        return saved && (player.name.trim() !== saved.name || firstCharacter(player.avatar) !== firstCharacter(saved.avatar) || player.color !== saved.color);
      });
      for (const player of changed) await onUpdate({ ...player, avatar: firstCharacter(player.avatar) });
      onClose();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setSaveError(detail.includes("Missing or insufficient permissions") ? "資料庫權限尚未更新，請重新整理後再試一次。" : detail || "儲存失敗，請再試一次。");
    } finally {
      setSavingPlayers(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal players-modal" role="dialog" aria-modal="true" aria-labelledby="players-title"><header className="modal-head"><div><p>FAMILY MEMBERS</p><h2 id="players-title">管理成員</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header><form className="new-player-form" onSubmit={onAdd}><label>新增成員<input value={newPlayer} onChange={(event) => setNewPlayer(event.target.value)} placeholder="輸入名字或暱稱" maxLength={12} /></label><label className="avatar-field">代表字<input value={newAvatar} onChange={(event) => setNewAvatar(event.target.value)} onCompositionEnd={(event) => setNewAvatar(firstCharacter(event.currentTarget.value))} onBlur={(event) => setNewAvatar(firstCharacter(event.currentTarget.value))} placeholder={firstCharacter(newPlayer) || "字"} aria-label="新成員代表字" /></label><label className="color-field">代表色<input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} /></label><button type="submit">＋ 加入</button></form><div className="player-edit-hint">點圓圈可修改顯示的代表字，修改完成後按下方「儲存並完成」</div><div className="player-edit-list">{editablePlayers.map((player) => <div key={player.id} className={!player.active ? "inactive" : ""}><input className="inline-avatar" style={{ background: player.color }} value={player.avatar} onChange={(event) => patchDraft(player.id, { avatar: event.target.value })} onCompositionEnd={(event) => patchDraft(player.id, { avatar: firstCharacter(event.currentTarget.value) })} onBlur={(event) => patchDraft(player.id, { avatar: firstCharacter(event.currentTarget.value) })} placeholder={firstCharacter(player.name) || "?"} aria-label={`${player.name}代表字`} /><input className="inline-color" type="color" value={player.color} onChange={(event) => patchDraft(player.id, { color: event.target.value })} aria-label={`${player.name}代表色`} /><input className="inline-name" value={player.name} onChange={(event) => patchDraft(player.id, { name: event.target.value })} aria-label={`${player.name}名稱`} /><span>{player.active ? "使用中" : "已停用"}</span><button type="button" className="remove-player" onClick={() => onRemove(player)}>{player.active ? "移除" : "刪除"}</button></div>)}</div>{saveError && <p className="player-save-error" role="alert">{saveError}</p>}<footer className="modal-actions"><p>代表字、顏色與名稱會一次儲存。</p><button className="save-button" type="button" disabled={savingPlayers} onClick={() => void saveAndClose()}>{savingPlayers ? "儲存中…" : "儲存並完成"}</button></footer></div></div>;
}
