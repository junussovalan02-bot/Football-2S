// Game data: clubs (kits, flags, looks, names, taunt emojis, home pitch), 12x12 pixel icons for the emojis,
// and pitch themes. Plain data so it is easy to add a club; drawing and rules live in src/game.js.
// All player names are made up. Loaded before src/game.js (window.AZZ_DATA).
(function () {
  const LOOK = {
    light: { skin:'#ffb88a', skinS:'#e0845a' }, tan: { skin:'#e8a070', skinS:'#c07848' },
    dark: { skin:'#8a5634', skinS:'#663c22' }, east: { skin:'#f6c898', skinS:'#d89c68' },
    pale: { skin:'#ffd0b8', skinS:'#e8a088' }, sea: { skin:'#8fd8c0', skinS:'#5aa890' },
  };
  const hair = (hair, hairHi, style) => ({ hair, hairHi, style });
  const kit = (jersey, jerseyS, sleeve, sleeveS, trim, shorts, shortsS, socks, socksS, color, hudBg, extra) =>
    Object.assign({ jersey, jerseyS, sleeve, sleeveS, trim, shorts, shortsS, socks, socksS, boots:'#202030', color, hudBg }, extra || {});
  const gk = (jersey, jerseyS, shorts, shortsS, trim) => ({ jersey, jerseyS, sleeve:jersey, sleeveS:jerseyS, shorts, shortsS, socks:jersey, socksS:jerseyS, trim });
  const BLACK = '#141010', BLACKHI = '#3a3030';

  // emo: taunt emojis (keys of ICONS); home: pitch theme; flag: [colours], dir 'v' | 'h' | special;
  // uniform: every player looks the same (no beards/glasses...); special: slot -> features for one player
  const clubs = {
    nap: Object.assign(kit('#4aa8f0','#2a74c4','#4aa8f0','#2a74c4','#ffffff','#ffffff','#b8c8e4','#4aa8f0','#2a74c4','#4aa8f0','#3d9be9'), {
      code:'NAP', skill:'lava', name:'НАПОЛИ', home:'stadium', emo:['pizza','volcano'], flag:['#4aa8f0','#ffffff','#4aa8f0'], dir:'v',
      gk: gk('#3ac85a','#249a40','#202030','#101018','#ffffff'),
      looks: [{ ...LOOK.light, ...hair('#1a1420','#463c5e','spiky') }, { ...LOOK.tan, ...hair('#3a2414','#6a4428','spiky') }, { ...LOOK.light, ...hair('#2a1a10','#5a3a20','crop') }],
      names: ['ЭСПОЗИТО','РУССО','КАПУАНО','ЙОРИО','АМАТО','ДЕ ЛУКА','ФЕРРАРА','ПАГАНО','КОППОЛА','ЧИРО','САВАСТАНО'] }),
    rom: Object.assign(kit('#ffffff','#cfc4c8','#a01c2c','#6c0e1a','#a01c2c','#a01c2c','#6c0e1a','#ffffff','#cfc4c8','#ff5a6a','#2a1a20'), {
      code:'ROM', skill:'shields', name:'РОМА', home:'piazza', emo:['wolf','pizza'], flag:['#a01c2c','#ffd23a'], dir:'v',
      gk: gk('#ff9a2a','#d0701a','#202030','#101018','#100810'),
      looks: [{ ...LOOK.light, ...hair('#a8381c','#d8622e','pomp') }, { ...LOOK.tan, ...hair('#3a2414','#6a4428','pomp') }, { ...LOOK.light, ...hair('#d8b040','#fff0a0','crop') }],
      names: ['ДЖЕНТИЛЕ','РИЧЧИ','МАРКЕТТИ','КОНТИ','ГАЛЛИ','ФОНТАНА','РИНАЛЬДИ','БАССИ','ТЕСТА','СЕРРА','МАНКУЗО'] }),
    rho: Object.assign(kit('#2f9a4a','#1f6e34','#ffffff','#c8d0c8','#ffffff','#ffffff','#c8d0c8','#2f9a4a','#1f6e34','#4ac86a','#1f6e34'), {
      code:'RHO', skill:'ghost', name:'РОДЕЗИЯ', home:'savanna', emo:['ghost','money'], flag:['#2f9a4a','#ffffff','#2f9a4a'], dir:'v',
      gk: gk('#2a2a3a','#16161e','#2a2a3a','#16161e','#ffd23a'),
      looks: [{ ...LOOK.light, ...hair('#d8b040','#fff0a0','pomp') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'crop') }, { ...LOOK.light, ...hair('#6a4020','#9a6438','crop') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'spiky') }],
      names: ['ХАРТЛИ','ПРАЙС','ШУМБА','ДОЙЛ','ВЕНТЕР','МАРОНГА','ЛАНД','ГИББ','ОРМОНД','БЭНКС','МАКАЛИСТЕР'] }),
    zim: Object.assign(kit('#ffd23a','#e0a020','#2a9a3a','#1a6a26','#1a6a26','#2a9a3a','#1a6a26','#ffd23a','#e0a020','#ffd23a','#2a9a3a'), {
      code:'ZIM', skill:'inflation', name:'ЗИМБАБВЕ', home:'savanna', emo:['money','ghost'], flag:['#2a9a3a','#ffd23a','#d8243a','#141010'], dir:'h',
      gk: gk('#3a6ad8','#2448a0','#3a6ad8','#2448a0','#ffffff'),
      looks: [{ ...LOOK.dark, ...hair(BLACK,BLACKHI,'crop') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'spiky') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'pomp') }],
      names: ['МОЙО','НКУБЕ','ДУБЕ','ЧИКОРЕ','МУТАСА','СИБАНДА','МХЛАНГА','ЧИРВА','ГУМБО','МАРУФУ','ЧАРИ'] }),
    prk: Object.assign(kit('#e83a2a','#a8140a','#e83a2a','#a8140a','#ffffff','#ffffff','#c8c8d4','#e83a2a','#a8140a','#ff6a4a','#a8140a'), {
      code:'PRK', skill:'rocket', name:'КНДР', home:'bamboo', emo:['rocket'], flag:['#2448a0','#ffffff','#d8243a','#ffffff','#2448a0'], dir:'h', uniform:true,
      gk: gk('#7a8aa0','#56647a','#202030','#101018','#ffffff'),
      looks: [{ ...LOOK.east, ...hair('#141018','#3a3a4a','pomp') }],
      names: ['РИ ЧХОЛ','КИМ ХЁН','ПАК УН','ЧХВЕ МЁН','ХАН СОН','ЧО КВАН','РЮ ЧХОН','СО ИЛЬ','КАН ХЁК','РИМ ТЭ','ЮН ОК'] }),
    kaz: Object.assign(kit('#2fb8e8','#1a86b8','#2fb8e8','#1a86b8','#ffd23a','#2fb8e8','#1a86b8','#2fb8e8','#1a86b8','#4ad0ff','#1a86b8'), {
      code:'KAZ', skill:'eagle', name:'КАЗАХСТАН', home:'steppe', emo:['horse','bowl','eagle'], flag:['#2fb8e8'], dir:'kaz',
      gk: gk('#ffd23a','#e0a020','#202030','#101018','#1a86b8'),
      looks: [{ ...LOOK.east, ...hair(BLACK,BLACKHI,'crop') }, { ...LOOK.tan, ...hair(BLACK,BLACKHI,'spiky') }, { ...LOOK.east, ...hair('#2a1a10','#5a3a20','pomp') }],
      names: ['ЕСЕНОВ','ОМАРОВ','ЖУМАБАЕВ','КАСЫМОВ','ИСКАКОВ','НУРЛАНОВ','АБДРАХМАНОВ','БЕКОВ','ЕРЖАНОВ','ДАУЛЕТОВ','САРСЕНОВ'] }),
    mng: Object.assign(kit('#c8202e','#901620','#2a4ab8','#1a3488','#ffd23a','#2a4ab8','#1a3488','#c8202e','#901620','#ff4a5a','#1a3488', { pattern:'sash' }), {
      code:'MNG', skill:'herd', name:'МОНГОЛИЯ', home:'gobi', emo:['ger','bow','horse'], flag:['#c8202e','#2a4ab8','#c8202e'], dir:'mng', uniform:true,
      gk: gk('#ffd23a','#e0a020','#2a4ab8','#1a3488','#c8202e'),
      looks: [{ ...LOOK.east, ...hair('#141018','#3a3a4a','crop') }],
      names: ['ГАНБААТАР','БОЛД','ДОРЖ','ЭНХ','ОЧИР','ТУМЭН','НЭРГУЙ','МУНХ','ЖАРГАЛ','ЦЭРЭН','БАТАР'] }),
    fra: Object.assign(kit('#2a3a9a','#1a2470','#2a3a9a','#1a2470','#ffffff','#ffffff','#c8d0e4','#e8243a','#a8141e','#6a8aff','#1a2470'), {
      code:'FRA', skill:'strike', name:'ФРАНЦИЯ', home:'stadium', emo:['baguette','croissant','beret'], flag:['#2a3a9a','#ffffff','#e8243a'], dir:'v',
      gk: gk('#9ae04a','#6ab02a','#202030','#101018','#202030'),
      looks: [{ ...LOOK.light, ...hair('#3a2414','#6a4428','pomp') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'crop') }, { ...LOOK.tan, ...hair(BLACK,BLACKHI,'spiky') }, { ...LOOK.light, ...hair('#d8b040','#fff0a0','crop') }],
      names: ['ЛЕРУА','МОРО','ЖИРАР','БОНЕ','ДЮРАН','ЛЕФЕВР','ФОНТЕН','ШЕВАЛЬЕ','ГАРНЬЕ','ДЮПОН','БАГЕТТ'] }),
    ger: Object.assign(kit('#ffffff','#cfcfd8','#ffffff','#cfcfd8','#141010','#141010','#000000','#ffffff','#cfcfd8','#e8e8f0','#141010'), {
      code:'GER', skill:'order', name:'ГЕРМАНИЯ', home:'snow', emo:['pretzel','sausage'], flag:['#141010','#d8243a','#ffd23a'], dir:'h',
      gk: gk('#3ac85a','#249a40','#141010','#000000','#ffffff'),
      looks: [{ ...LOOK.light, ...hair('#d8b040','#fff0a0','crop') }, { ...LOOK.light, ...hair('#6a4020','#9a6438','pomp') }, { ...LOOK.tan, ...hair(BLACK,BLACKHI,'crop') }],
      names: ['НОЙМАН','ШМИДТ','ВАГНЕР','БЕККЕР','ШУЛЬЦ','ХОФМАН','КЛЯЙН','ВОЛЬФ','БРАУН','ШРЁДЕР','ШНИЦЕЛЬ'] }),
    eng: Object.assign(kit('#ffffff','#d0d4e4','#ffffff','#d0d4e4','#d8243a','#1a2a6a','#0e1a48','#ffffff','#d0d4e4','#ff7a8a','#1a2a6a'), {
      code:'ENG', skill:'home', name:'АНГЛИЯ', home:'rainy', emo:['tea','umbrella'], flag:['#ffffff','#d8243a'], dir:'cross',
      gk: gk('#ffd23a','#e0a020','#ffd23a','#e0a020','#1a2a6a'),
      looks: [{ ...LOOK.pale, ...hair('#c8501c','#ff8a3a','crop') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'crop') }, { ...LOOK.light, ...hair('#6a4020','#9a6438','spiky') }],
      names: ['УОКЕР','СМИТ','ДЖОНС','ТЕЙЛОР','БРАУН','УИЛСОН','ЭВАНС','РОБЕРТС','РАЙТ','ГРИН','ЭРЛГРЕЙ'] }),
    esp: Object.assign(kit('#d8243a','#a0141e','#d8243a','#a0141e','#ffd23a','#1a2a6a','#0e1a48','#1a2a6a','#0e1a48','#ff4a5a','#a0141e'), {
      code:'ESP', skill:'bull', name:'ИСПАНИЯ', home:'stadium', emo:['bull','paella'], flag:['#d8243a','#ffd23a','#ffd23a','#d8243a'], dir:'h',
      gk: gk('#202030','#101018','#202030','#101018','#ffd23a'),
      looks: [{ ...LOOK.tan, ...hair(BLACK,BLACKHI,'pomp') }, { ...LOOK.light, ...hair('#3a2414','#6a4428','spiky') }, { ...LOOK.tan, ...hair('#3a2414','#6a4428','crop') }],
      names: ['КАСАС','ГАРСИЯ','ЛОПЕС','МАРТИНЕС','САНЧЕС','ПЕРЕС','ГОМЕС','РУИС','ДИАС','МОРЕНО','ПАЭЛЬЯС'] }),
    por: Object.assign(kit('#a8142a','#780a1c','#a8142a','#780a1c','#2a9a3a','#2a9a3a','#1a6a26','#a8142a','#780a1c','#ff5a6a','#780a1c'), {
      code:'POR', skill:'feint', name:'ПОРТУГАЛИЯ', home:'beach', emo:['sardine','rooster'], flag:['#2a9a3a','#d8243a','#d8243a'], dir:'v',
      gk: gk('#ffd23a','#e0a020','#202030','#101018','#202030'),
      looks: [{ ...LOOK.tan, ...hair(BLACK,BLACKHI,'spiky') }, { ...LOOK.tan, ...hair('#3a2414','#6a4428','pomp') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'crop') }],
      names: ['КОШТА','СИЛВА','САНТУШ','ФЕРРЕЙРА','ПЕРЕЙРА','ОЛИВЕЙРА','РОДРИГЕШ','МАРТИНШ','СОУЗА','ГОМЕШ','САРДИНЬЯ'] }),
    ned: Object.assign(kit('#ff8a1a','#d0600a','#ff8a1a','#d0600a','#ffffff','#ff8a1a','#d0600a','#ff8a1a','#d0600a','#ffa040','#d0600a'), {
      code:'NED', skill:'bikes', name:'НИДЕРЛАНДЫ', home:'tulips', emo:['tulip','cheese','clog'], flag:['#d8243a','#ffffff','#2448a0'], dir:'h',
      gk: gk('#2448a0','#1a3478','#2448a0','#1a3478','#ffffff'),
      looks: [{ ...LOOK.light, ...hair('#d8b040','#fff0a0','crop') }, { ...LOOK.light, ...hair('#e8c060','#fff4b0','pomp') }, { ...LOOK.dark, ...hair(BLACK,BLACKHI,'crop') }],
      names: ['БОС','ДЕ ЙОНГ','ЯНСЕН','ДЕ ВРИС','ВАН ДАМ','БАККЕР','ВИССЕР','МЕЙЕР','ДЕ БУР','МУЛДЕР','ВАН ТЮЛЬПАН'] }),
    ant: Object.assign(kit('#202030','#101018','#202030','#101018','#ffffff','#202030','#101018','#ff9a1a','#d0700a','#c8e0ff','#202030', { pattern:'penguin' }), {
      code:'ANT', skill:'blizzard', name:'АНТАРКТИДА', home:'ice', emo:['penguin','snowflake'], flag:['#4a8ad8','#ffffff','#4a8ad8'], dir:'h',
      gk: gk('#ffffff','#c8d4e0','#202030','#101018','#4a8ad8'),
      looks: [{ ...LOOK.pale, ...hair('#e8eef4','#ffffff','crop') }, { ...LOOK.pale, ...hair('#6a4020','#9a6438','spiky') }, { ...LOOK.light, ...hair('#c8501c','#ff8a3a','pomp') }],
      names: ['АЙСБЕРГ','ХОЛОДОВ','ТЮЛЕНЕВ','ВЬЮГИН','ПУРГА','МОРОЗОВ','СНЕЖОК','ФРОСТ','ЛЕДЯНСКИЙ','ПОЛЯРНИКОВ','ПИНГВИНОВ'],
      beardy: true }),
    sea: Object.assign(kit('#d8243a','#a0141e','#202030','#101018','#ffffff','#202030','#101018','#d8243a','#a0141e','#ff5a5a','#202030', { pattern:'sash' }), {
      code:'SEA', skill:'cannon', name:'СИЛЕНД', home:'platform', emo:['anchor','crab'], flag:['#d8243a','#ffffff','#141010'], dir:'diag',
      gk: gk('#ffd23a','#e0a020','#202030','#101018','#202030'),
      looks: [{ ...LOOK.light, ...hair('#6a4020','#9a6438','crop') }, { ...LOOK.pale, ...hair('#c8501c','#ff8a3a','spiky') }, { ...LOOK.tan, ...hair(BLACK,BLACKHI,'pomp') }],
      names: ['ЯКОРЬ','ТРОС','ШТОРМ','ВОЛНА','БАРНАКЛ','КРЮК','ЧАЙКА','ПРИЛИВ','МАЯК','МАЛЫШ','ГАРПУН'],
      special: { 9: 'short beard' }, beardy: true }),
    vat: Object.assign(kit('#ffd23a','#e0a020','#2a4ad8','#1a3498','#d8243a','#2a4ad8','#1a3498','#ffd23a','#e0a020','#ffe14a','#2a4ad8', { pattern:'stripes', stripe:'#2a4ad8' }), {
      code:'VAT', skill:'miracle', name:'ВАТИКАН', home:'piazza', emo:['key','candle'], flag:['#ffd23a','#ffffff'], dir:'v',
      gk: gk('#d8243a','#a0141e','#202030','#101018','#ffd23a'),
      looks: [{ ...LOOK.light, ...hair('#6a6a70','#9a9aa0','crop') }, { ...LOOK.light, ...hair('#3a2414','#6a4428','pomp') }, { ...LOOK.pale, ...hair('#d8b040','#fff0a0','crop') }],
      names: ['ГУГГЕНБЮЛЬ','ЦУРБРИГГЕН','ШТАЙНЕР','МАЙЕР','КЕЛЛЕР','ВЕБЕР','ФИШЕР','ЭГГЕР','ХУБЕР','ГАФНЕР','ЛАНЦ'] }),
    atl: Object.assign(kit('#2ad8c8','#1aa098','#2ad8c8','#1aa098','#ffe14a','#1a5a8a','#0e3a62','#2ad8c8','#1aa098','#5af0e0','#1a5a8a', { pattern:'hoops', stripe:'#ffe14a' }), {
      code:'ATL', skill:'tsunami', name:'АТЛАНТИДА', home:'underwater', emo:['trident','fish'], flag:['#1a5a8a','#2ad8c8','#1a5a8a'], dir:'h',
      gk: gk('#ff8a6a','#d8604a','#1a5a8a','#0e3a62','#ffe14a'),
      looks: [{ ...LOOK.sea, ...hair('#2a8a3a','#5ac86a','long') }, { ...LOOK.sea, ...hair('#1a5a6a','#3a8a9a','spiky') }, { ...LOOK.sea, ...hair('#ffe14a','#fff4b0','long') }],
      names: ['КРАБОС','НЕПТУНИС','ТРИТОНОС','КОРАЛЛИС','МЕДУЗИС','ЖЕМЧУГОС','ПРИЛИВИС','РИФОС','СКАТОС','АКВАРИС','ОСЬМИНОС'] }),
  };

  // 12x12 icons: one character per pixel, '.' = transparent, letters from the palette
  const P = (pal, rows) => ({ pal, rows });
  const icons = {
    pizza: P({ c:'#c87a2a', d:'#e8a050', y:'#ffd23a', r:'#d8344a', g:'#3a9a3a' }, [
      'cccccccccccc','dddddddddddd','.yyyyyyyyyy.','.yryyyyyryy.','..yyyygyyy..','..yyryyyyy..','...yyyyyy...','...yygyry...','....yyyy....','....yryy....','.....yy.....','.....y......']),
    volcano: P({ k:'#5a4a4a', d:'#3a2a2a', r:'#ff5a1a', y:'#ffd23a', s:'#a0a0a8' }, [
      '..s...s.....','.s..s...s...','....rry.....','....ryr.....','...kryrk....','...kkrkkk...','..kkkrkkkk..','..kdkkkkdk..','.kkkkdkkkkk.','.kdkkkkkdkk.','kkkkkkkkkkkk','dddddddddddd']),
    wolf: P({ g:'#8a8a98', d:'#5a5a68', w:'#e8e8f0', k:'#141010', r:'#d8344a' }, [
      '.g.......g..','.gg.....gg..','.ggggggggg..','gggggggggg..','gwkgggwkgg..','gggggggggg..','.gggggggggg.','.ggwwwwwgggg','..gwkwwwwgg.','..gwwrrwwg..','...gwwwwg...','....gggg....']),
    ghost: P({ w:'#f4f4ff', s:'#c8c8e0', k:'#141010' }, [
      '....wwww....','..wwwwwwww..','.wwwwwwwwww.','.wwkkwwkkww.','.wwkkwwkkww.','wwwwwwwwwwww','wwwwwkkwwwww','wwwwwkkwwwww','wwwwwwwwwwww','wwwwwwwwwwww','wsww.ww.wwsw','w..w.ww.w..w']),
    money: P({ g:'#6ac85a', d:'#3a8a3a', w:'#d8f0c8', k:'#141010' }, [
      '............','.gggggggggg.','gdddddddddddg'.slice(0,12),'gdwwwwwwwwdg','gdwgggkgwwdg','gdwgkkkkgwdg','gdwgggkkgwdg','gdwgkkkkgwdg','gdwwwkgwwwdg','gdddddddddddg'.slice(0,12),'.gggggggggg.','............']),
    rocket: P({ w:'#e8e8f0', s:'#a0a0b0', r:'#d8243a', y:'#ffd23a', o:'#ff8a1a', b:'#4ab8ff' }, [
      '.....rr.....','....rrrr....','....wwww....','....wbbw....','....wbbw....','....wwww....','....wwww....','...rwwwwr...','..rrwwwwrr..','..r.wwww.r..','....oyyo....','.....yy.....']),
    horse: P({ b:'#8a4a2a', d:'#5a2a1a', k:'#141010', w:'#f0e0c8' }, [
      '....dd......','...dbbb.....','..dbbbbb....','..dbkbbbb...','.dbbbbbbbb..','.dbbbbbbbbb.','.dbbbbwwbbb.','..dbbbbbbbbk','...dbbbbbbbk','...dbbbb.kk.','...dbbb.....','..dbbbb.....']),
    bowl: P({ w:'#f4f0e8', s:'#c8c0b0', y:'#f0d070', m:'#a0502a', g:'#5ac85a' }, [
      '............','...m.y.m.y..','..ymymymymy.','.myymgymmyy.','.yymmyygymm.','wwwwwwwwwwww','swwwwwwwwwws','.swwwwwwwws.','..swwwwwws..','...ssssss...','....wwww....','............']),
    eagle: P({ b:'#6a4020', d:'#3a2410', y:'#ffd23a', w:'#f4f4f4', k:'#141010' }, [
      '....www.....','...wwkwy....','...wwwwyy...','....bbb.....','.bbbbbbbbbb.','bbdbbbbbbdbb','bd.bbbbbb.db','b..bbbbbb..b','....bbbb....','....dbbd....','....y..y....','...yy..yy...']),
    baguette: P({ b:'#e8a050', d:'#b8742a', w:'#fff0c8' }, [
      '..........bb','.........bbd','........bwbd','.......bbbd.','......bwbd..','.....bbbd...','....bwbd....','...bbbd.....','..bwbd......','.bbbd.......','bbbd........','dd..........']),
    croissant: P({ b:'#e8a050', d:'#b8742a', w:'#fff0c8' }, [
      '............','..b......b..','.bd......db.','.bbd....dbb.','.bbbddddbbb.','..bwbbbbwbb.','..bbbwwbbbb.','...dbbbbbd..','....dddd....','............','............','............']),
    beret: P({ k:'#202030', s:'#3a3a4a', r:'#d8243a' }, [
      '............','.....k......','.....kk.....','...kkkkkk...','.kkkkkkkkkk.','kkkskkkkkkkk','kkkkkkkkskkk','.kkkkkkkkkk.','..rrrrrrrr..','............','............','............']),
    pretzel: P({ b:'#a0582a', d:'#6a3414', w:'#f4f4f4' }, [
      '............','..bbbb.bbbb.','.bd..bbd..bd','.b...bb...b.','.b..b..b..b.','.bd.b..b.db.','..bbbwbbbb..','....bb.bb...','...bd...db..','...b.....b..','...bbbbbbb..','............']),
    sausage: P({ r:'#c8503a', d:'#8a2a1a', w:'#f0d8c8', y:'#ffd23a' }, [
      '............','..........r.','.........rr.','........rrd.','.......rrd..','......rwrd..','.....rrrd...','...rrwrd....','..rrrrd.....','.rrwyd......','.rrdd.......','..d.........']),
    tea: P({ w:'#f4f4f4', s:'#c8c8d4', b:'#a0582a', k:'#141010' }, [
      '....s..s....','.....s..s...','....s..s....','............','.wwwwwwwww..','.wbbbbbbbwww','.wwwwwwwwwsw','.wwwwwwwwwsw','.swwwwwwwww.','..swwwwwws..','.sssssssss..','............']),
    umbrella: P({ k:'#202030', s:'#4a4a5a', b:'#8a6040', t:'#4ab8ff' }, [
      '.t..........','.....kk.....','...kkkkkk...','..kkskkskk..','.kkkkkkkkkk.','kskkskkskksk','.....b......','.t...b...t..','.....b......','.....b......','..t..b.b....','......b.....']),
    bull: P({ k:'#2a1a14', d:'#141010', w:'#f4f0e8', r:'#d8243a', p:'#c87a6a' }, [
      'w..........w','ww........ww','.wkkkkkkkkw.','..kkkkkkkk..','..krkkkkrk..','..kkkkkkkk..','...kkkkkk...','...kppppk...','...pkppkp...','....pppp....','.....yy.....'.replace(/y/g,'w'),'....w..w....']),
    paella: P({ k:'#202030', y:'#ffd23a', o:'#ff8a1a', r:'#d8243a', g:'#5ac85a', p:'#ffb0a0' }, [
      '............','............','kk........kk','.kkkkkkkkkk.','.kyyoyyryyk.','kyrypyyogyyk','kyyyyroyyyyk','kygyyyypyryk','.kyoyyryyyk.','..kkkkkkkk..','............','............']),
    sardine: P({ s:'#a8b8c8', d:'#6a7a8a', w:'#e8f0f8', k:'#141010' }, [
      '............','............','.........d..','..ssssssd.dd','.swksssssddd','sswwwwwssddd','.sswwwssd.dd','..ssssssd...','.........d..','............','............','............']),
    rooster: P({ k:'#202030', r:'#d8243a', y:'#ffd23a', w:'#f4f4f4', b:'#2a4ad8' }, [
      '...rr.......','..rkkk......','..kwkky.....','..kkkkyy....','..rkkk......','...kkkk..kk.','..kkrkkkkkbk','.kkkkkkkkkbk','.kkbkkkkbkk.','..kkkkkkkk..','....y..y....','...yy.yy....']),
    tulip: P({ r:'#e8243a', p:'#ff6a7a', g:'#3a9a3a', d:'#2a6a26' }, [
      '..r..r..r...','..rrprprr...','..rrrprrr...','..rrrrrrr...','...rrrrr....','....rrr.....','.....g......','..g..g......','..gg.g..g...','...ggg.gg...','.....ggg....','.....g......']),
    cheese: P({ y:'#ffd23a', o:'#e0a020', w:'#fff4b0' }, [
      '............','........yy..','......yyyy..','....yywyyyy.','..yyyyyyyyy.','yyyyyyyyyyy.','yoyywyyyoyy.','yyyyyyyowyy.','ywyoyyyyyyy.','yyyyyowyyy..','oooooooooo..','............']),
    clog: P({ y:'#ffd23a', o:'#e0a020', w:'#fff4b0', r:'#d8243a' }, [
      '............','............','.......yyy..','......yyyyy.','.....ywoooy.','yyyyyyoooyy.','ywyyyyyyyyy.','yyyryyyyyyy.','yyyyyyyyyyo.','.yyyyyyyyoo.','..oooooooo..','............']),
    penguin: P({ k:'#202030', w:'#f4f4f4', o:'#ff9a1a' }, [
      '....kkkk....','...kkkkkk...','..kkwkkwkk..','..kkkookkk..','..kwwwwwwk..','.kkwwwwwwkk.','.kkwwwwwwkk.','kk.wwwwww.kk','...wwwwww...','...kwwwwk...','...oo..oo...','............']),
    snowflake: P({ w:'#ffffff', b:'#8fe0ff' }, [
      '.....w......','...w.w.w....','....www.....','.w..bwb..w..','..w.bwb.w...','wwwwwbwwwww.','..w.bwb.w...','.w..bwb..w..','....www.....','...w.w.w....','.....w......','............']),
    anchor: P({ k:'#3a4a5a', s:'#6a7a8a' }, [
      '....kkk.....','....k.k.....','....kkk.....','..kkkkkkk...','.....k......','.....k......','.....k......','k....k....k.','kk...k...kk.','.kk..k..kk..','..kkkkkkk...','....kkk.....']),
    crab: P({ r:'#e84a2a', d:'#a82a1a', k:'#141010', w:'#ffffff' }, [
      'rr........rr','r.r......r.r','rrr......rrr','.r..w..w..r.','.r..k..k..r.','..rrrrrrrr..','.rrrrrrrrrr.','rrrdrrrrdrrr','.rrrrrrrrrr.','r.r.r..r.r.r','.r.r....r.r.','............']),
    key: P({ y:'#ffd23a', o:'#c89a1a' }, [
      '..yyyy......','.yo..oy.....','.y....y.....','.y....y.....','.yo..oy.....','..yyyy......','...yy.......','...yy.......','...yyyy.....','...yy.......','...yyyy.....','...yy.......']),
    candle: P({ w:'#f4f0e0', s:'#c8c0a8', y:'#ffd23a', o:'#ff8a1a' }, [
      '.....o......','....oyo.....','....oyo.....','.....y......','.....k......'.replace('k','s'),'....wwww....','....wwww....','....wwws....','....wwws....','....wwws....','..ssssssss..','...ssssss...']),
    trident: P({ y:'#ffd23a', o:'#c89a1a' }, [
      'y....y....y.','y....y....y.','y....y....y.','yy...y...yy.','.yyyyyyyyy..','.....y......','.....y......','.....y......','.....o......','.....y......','.....y......','.....o......']),
    ger: P({ w:'#f4f0e4', s:'#c8c0b0', r:'#d8243a', b:'#2a4ab8', d:'#8a5a2a' }, [
      '............','.....ss.....','...wwwwww...','..wwwwwwww..','.wwwwwwwwww.','.rrrrrrrrrr.','.wwwwddwwww.','.wbwwddwwbw.','.wwwwddwwww.','.wwwwddwwww.','.ssssssssss.','............']),
    bow: P({ b:'#8a4a2a', d:'#5a2a1a', s:'#e8e0c8', a:'#a0a0b0', f:'#d8243a' }, [
      '..b.........','..db........','..d.b.......','..d..b......','..d...b...a.','ffd...b..a..','..sssssaa...','..d...ba....','..d..ab.....','..d.ab......','..dab.......','..ab........']),
    camel: P({ c:'#d8a050', d:'#a8742a', k:'#141010' }, [
      '..........cc','.........ckc','...cc.cc.cc.','..cccccccc..','.cccccccccc.','cccccccccc..','c.cccccccc..','..cd.cd.....','..c..c.c....','..c..c.c....','..c..c.c....','..d..d.d....']),
    fish: P({ o:'#ff8a1a', y:'#ffd23a', w:'#ffffff', k:'#141010' }, [
      '............','............','....ooo.....','..oooooo..o.','.owkooyoo.oo','ooooooyooooo','.oooooyoo.oo','..oooooo..o.','....ooo.....','............','............','............']),
  };

  // Pitch themes (career flies between them; 11 on 11 plays at the opponent's home).
  // grass: [stripe A, stripe A speck, stripe B dark, stripe B light]; phys multipliers: fric (ball rolling
  // friction), bounce (ball restitution), traction & speed (players), grav (gravity), air (ball drag in the air);
  // weather: forced weather; critter: what crosses the pitch now and then; tint: screen overlay.
  const themes = {
    stadium:   { name:'СТАДИОН', grass:['#46cf40','#3cbc38','#30a82e','#44c83e'], line:'#ffffff', track:['#bcbcc4','#a4a4b0'], back:'crowd', phys:{} },
    savanna:   { name:'САВАННА', grass:['#c8c050','#b8b040','#a8a838','#bcb848'], line:'#fff8e0', track:['#c8703a','#a85a2a'], back:'savanna',
                 phys:{ bounce:1.4, fric:0.8 }, weather:'clear', critter:'elephant', dust:true },
    bamboo:    { name:'БАМБУК', grass:['#62d058','#58c450','#48b040','#56c04c'], line:'#ffffff', track:['#a8c890','#90b078'], back:'bamboo',
                 phys:{ fric:1.1 }, critter:'panda', leaves:true },
    snow:      { name:'СНЕГ', grass:['#f2f6fa','#e4ecf4','#dce6f0','#ecf2f8'], line:'#d83a3a', track:['#c8d4e0','#b0c0d0'], back:'snowcrowd',
                 phys:{ fric:2.2, bounce:0.45, traction:0.55, speed:0.9 }, weather:'snow', critter:'snowman' },
    ice:       { name:'ЛЁД', grass:['#bfe8f8','#aedcf0','#a4d4ec','#c8ecfa'], line:'#2a6ad8', track:['#e8f4fa','#d0e4f0'], back:'icebergs',
                 phys:{ fric:0.3, traction:0.14, bounce:1.1 }, weather:'clear', critter:'penguin' },
    steppe:    { name:'СТЕПЬ', grass:['#c8b048','#bca43c','#b09834','#c4ac44'], line:'#fff8e0', track:['#9a7a4a','#866a3e'], back:'steppe',
                 phys:{ fric:0.9 }, weather:'clear', critter:'horse', wind:55 },
    beach:     { name:'ПЛЯЖ', grass:['#f2dc9a','#e8d088','#e0c87e','#f0d894'], line:'#ffffff', track:['#f8e8b8','#e8d8a8'], back:'sea',
                 phys:{ fric:2.6, bounce:0.35, speed:0.85, traction:0.8 }, weather:'clear', critter:'crab' },
    rainy:     { name:'ДОЖДЬ', grass:['#3cb83a','#34a832','#2a962a','#38b036'], line:'#ffffff', track:['#8a4a3a','#7a3e30'], back:'bricks',
                 phys:{}, weather:'rain' },
    tulips:    { name:'ТЮЛЬПАНЫ', grass:['#4ac844','#40bc3c','#36ac32','#46c440'], line:'#ffffff', track:['#e8243a','#ff8a1a'], back:'windmills',
                 phys:{}, weather:'clear', critter:'cow', wind:35 },
    platform:  { name:'ПЛАТФОРМА', grass:['#8a8a90','#7c7c84','#70707a','#84848c'], line:'#ffd23a', track:['#5a6a8a','#4a5a7a'], back:'ocean',
                 phys:{ bounce:1.6, fric:0.7 }, weather:'storm', critter:'seagull' },
    piazza:    { name:'ПЬЯЦЦА', grass:['#d8d0c0','#ccc4b4','#c0b8a8','#d4ccbc'], line:'#8a6a4a', track:['#b8a890','#a89880'], back:'colonnade',
                 phys:{ bounce:1.5, fric:0.75 }, weather:'clear', critter:'pigeon' },
    gobi:      { name:'ГОБИ', grass:['#e8b870','#dca864','#d09c58','#e4b46c'], line:'#fff4e0', track:['#c88a4a','#b07a40'], back:'dunes',
                 phys:{ fric:1.8, bounce:0.6, speed:0.92 }, weather:'clear', critter:'camel', wind:70, dust:true },
    underwater:{ name:'ДНО ОКЕАНА', grass:['#d8c890','#ccbc84','#c0b078','#d4c48c'], line:'#ffffff', track:['#2a6a8a','#1a5a7a'], back:'reef',
                 phys:{ grav:0.45, air:0.5, speed:0.9 }, weather:'clear', critter:'shark', tint:'rgba(20,90,160,.22)', bubbles:true },
  };

  window.AZZ_DATA = { LOOK, clubs, icons, themes };
})();
