(function (root) {
  "use strict";
  const D = root.ElectronData, C = root.ElectronCore;
  const TARGET = 3;
  function random(session) {
    let n = session.rng >>> 0;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    session.rng = n >>> 0;
    return session.rng / 4294967296;
  }
  function shuffle(session, values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random(session) * (i + 1)); [result[i],result[j]] = [result[j],result[i]]; }
    return result;
  }
  function pool(session, representation) {
    return D.species.filter((item) => session.groups.includes(item.group) && (representation !== "short" || C.coreOptions(item).length));
  }
  function create(options, seed) {
    const groups = D.groups.map((g) => g.id).filter((id) => options.groups.includes(id));
    const representations = D.representations.map((r) => r.id).filter((id) => options.representations.includes(id));
    if (!groups.length || !representations.length) throw new Error("Choose at least one species group and one representation.");
    const session = {
      version:D.version, groups, representations, bonus: options.bonus !== false,
      rng:(Number(seed) || 314159265) >>> 0, progress:{}, groupUses:{}, speciesUses:{},
      directionUses:{build:0,identify:0}, mainCount:0, correctCount:0,
      bonusCount:0, bonusCorrect:0, bonusDue:false, lastSpecies:null, lastSkill:null,
      current:null, response:C.blankResponse(), result:null, completed:false
    };
    for (const representation of representations) for (const direction of ["build","identify"]) {
      session.progress[`${direction}:${representation}`] = {streak:0,streakIds:[],attempts:0,groupUses:{}};
    }
    next(session);
    return session;
  }
  function bonusQuestion(session, reviewId) {
    if (root.QuestionReview) {
      const mask = D.groups.reduce((n,g,i)=>n+(session.groups.includes(g.id)?2**i:0),0);
      const modulus = 2 ** D.groups.length;
      reviewId = reviewId || root.QuestionReview.format('ECB', ((session.rng >>> 0) % Math.floor(root.QuestionReview.capacity/modulus))*modulus+mask);
      session.rng = root.QuestionReview.parse('ECB',reviewId);
    }
    const items = pool(session);
    const buckets = new Map();
    for (const item of items) { const key = item.counts.join(","); if (!buckets.has(key)) buckets.set(key,[]); buckets.get(key).push(item); }
    const eligible = [...buckets.values()].filter((bucket) => bucket.length >= 2 && items.length - bucket.length >= 3);
    if (!eligible.length) return null;
    const matches = shuffle(session, eligible)[0];
    const positive = shuffle(session,matches).slice(0,3);
    const negative = shuffle(session,items.filter((item) => !C.same(item.counts,matches[0].counts))).slice(0,3);
    return {reviewId,kind:"bonus",counts:matches[0].counts.slice(),options:shuffle(session,[...positive,...negative].map((item) => item.id))};
  }
  function next(session) {
    if (session.current && !session.result) return session.current;
    session.result = null; session.response = C.blankResponse(); session.current = null;
    if (session.bonusDue) {
      session.bonusDue = false;
      session.current = bonusQuestion(session);
      if (session.current) return session.current;
    }
    const available = Object.keys(session.progress).filter((key) => session.progress[key].streak < TARGET);
    if (!available.length) { session.completed = true; return null; }
    const skills = shuffle(session,available).sort((a,b) => {
      const da = a.split(":")[0], db = b.split(":")[0];
      return session.directionUses[da] - session.directionUses[db] || session.progress[a].attempts - session.progress[b].attempts || Number(a === session.lastSkill) - Number(b === session.lastSkill);
    });
    const skill = skills[0], [direction,representation] = skill.split(":"), record = session.progress[skill];
    let candidates = pool(session,representation).filter((item) => !record.streakIds.includes(item.id));
    if (candidates.some((item) => item.id !== session.lastSpecies)) candidates = candidates.filter((item) => item.id !== session.lastSpecies);
    candidates = shuffle(session,candidates).sort((a,b) =>
      (record.groupUses[a.group] || 0) - (record.groupUses[b.group] || 0) ||
      (session.groupUses[a.group] || 0) - (session.groupUses[b.group] || 0) ||
      (session.speciesUses[a.id] || 0) - (session.speciesUses[b.id] || 0));
    const item = candidates[0];
    session.current = {kind:"main",skill,direction,representation,speciesId:item.id};
    session.lastSpecies = item.id; session.lastSkill = skill;
    return session.current;
  }
  function submit(session) {
    if (!session.current || session.result) return session.result;
    const result = C.mark(session.current,session.response);
    if (!result.accepted) return result;
    session.result = result;
    if (session.current.kind === "bonus") { session.bonusCount++; if (result.correct) session.bonusCorrect++; return result; }
    const question = session.current, item = C.species(question.speciesId), record = session.progress[question.skill];
    record.attempts++;
    record.groupUses[item.group] = (record.groupUses[item.group] || 0) + 1;
    session.groupUses[item.group] = (session.groupUses[item.group] || 0) + 1;
    session.speciesUses[item.id] = (session.speciesUses[item.id] || 0) + 1;
    session.directionUses[question.direction]++;
    session.mainCount++;
    if (result.correct) { record.streak++; record.streakIds.push(item.id); session.correctCount++; }
    else { record.streak = 0; record.streakIds = []; }
    session.bonusDue = session.bonus && session.mainCount % 8 === 0;
    return result;
  }
  function skipBonus(session) {
    if (session.current?.kind !== "bonus") return;
    session.current = null; session.result = null; next(session);
  }
  function valid(saved) {
    try {
      if (!saved || saved.version !== D.version || !Array.isArray(saved.groups) || !Array.isArray(saved.representations) || !saved.groups.length || !saved.representations.length) return false;
      if (new Set(saved.groups).size !== saved.groups.length || new Set(saved.representations).size !== saved.representations.length) return false;
      if (saved.groups.some((id) => !D.groups.some((g) => g.id === id)) || saved.representations.some((id) => !D.representations.some((r) => r.id === id))) return false;
      const keys = saved.representations.flatMap((r) => [`build:${r}`,`identify:${r}`]);
      if (!C.same(Object.keys(saved.progress).sort(),keys.sort())) return false;
      const nonnegative = (n) => Number.isSafeInteger(n) && n >= 0;
      if (!nonnegative(saved.rng) || !saved.rng || saved.rng > 4294967295 || typeof saved.bonus !== "boolean" || typeof saved.bonusDue !== "boolean" || typeof saved.completed !== "boolean") return false;
      if ([saved.mainCount,saved.correctCount,saved.bonusCount,saved.bonusCorrect,...Object.values(saved.groupUses),...Object.values(saved.speciesUses),saved.directionUses.build,saved.directionUses.identify].some((n) => !nonnegative(n))) return false;
      if (saved.correctCount > saved.mainCount || saved.bonusCorrect > saved.bonusCount) return false;
      for (const key of keys) {
        const p = saved.progress[key];
        if (!nonnegative(p.streak) || p.streak > TARGET || !nonnegative(p.attempts) || p.attempts < p.streak || !Array.isArray(p.streakIds) || p.streakIds.length !== p.streak || new Set(p.streakIds).size !== p.streak) return false;
        if (p.streakIds.some((id) => !pool(saved,key.split(":")[1]).some((item) => item.id === id)) || Object.values(p.groupUses).some((n) => !nonnegative(n))) return false;
      }
      const response = saved.response;
      if (!response || !Array.isArray(response.counts) || response.counts.length !== 8 || response.counts.some((v) => typeof v !== "string" || v.length > 2)) return false;
      if (typeof response.identity !== "string" || response.identity.length > 80 || typeof response.core !== "string" || (response.core && !D.cores[response.core])) return false;
      if (!Array.isArray(response.boxes) || response.boxes.length !== 8 || response.boxes.some((row,i) => !Array.isArray(row) || row.length !== D.orbitals[i] || row.some((v) => ![0,1,2,3].includes(v)))) return false;
      if (!Array.isArray(response.selected) || response.selected.some((id) => !C.species(id))) return false;
      const q = saved.current;
      if (saved.completed) return q === null && saved.result === null && keys.every((key) => saved.progress[key].streak === TARGET);
      if (!q) return false;
      if (q.kind === "main") {
        if (!keys.includes(q.skill) || q.skill !== `${q.direction}:${q.representation}` || !pool(saved,q.representation).some((item) => item.id === q.speciesId)) return false;
      } else if (q.kind === "bonus") {
        if (!Array.isArray(q.options) || q.options.length < 5 || q.options.length > 6 || new Set(q.options).size !== q.options.length || q.options.some((id) => !pool(saved).some((item) => item.id === id))) return false;
        if (!Array.isArray(q.counts) || q.counts.length !== 8 || !D.species.some((item) => C.same(item.counts,q.counts))) return false;
        const matches = q.options.filter((id) => C.same(C.species(id).counts,q.counts)).length;
        if (matches < 2 || matches === q.options.length) return false;
      } else return false;
      if (saved.result !== null) {
        const checked = C.mark(q,response);
        if (!checked.accepted || JSON.stringify(checked) !== JSON.stringify(saved.result)) return false;
      }
      return true;
    } catch { return false; }
  }
  function bonusFromReviewId(id) {
    const seed=root.QuestionReview.parse('ECB',id),mask=seed%(2**D.groups.length);
    const groups=D.groups.filter((g,i)=>mask & 2**i).map(g=>g.id);
    if(!groups.length)throw new Error('This review ID has no species groups.');
    const result=bonusQuestion({groups,rng:seed},root.QuestionReview.format('ECB',seed));
    if(!result)throw new Error('No matching question is available for that ID.');
    return result;
  }
  root.ElectronSession = {bonusFromReviewId,TARGET,create,next,submit,skipBonus,valid,pool};
})(typeof globalThis !== "undefined" ? globalThis : window);
