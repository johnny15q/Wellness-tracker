(() => {
  const KJ_TO_KCAL = 1/4.184;
  const $ = id => document.getElementById(id);
  const todayISO = (d=new Date())=>d.toISOString().slice(0,10);
  const LS_KEY = 'fd_tracker_v3';
  let state = {workouts:[], foods:[]};

  // init
  $('workoutDate').value = todayISO();
  $('foodDate').value = todayISO();

  function load(){ try{ const raw = localStorage.getItem(LS_KEY); if(raw) state = JSON.parse(raw); }catch(e){console.error(e)} }
  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

  // add handlers
  $('addWorkout').addEventListener('click', ()=>{
    const name = $('workoutName').value.trim();
    const duration = Number($('workoutDuration').value) || 0;
    const calories = Number($('workoutCalories').value) || 0;
    const date = $('workoutDate').value || todayISO();
    const time = $('workoutTime').value || '';
    if(!name){ alert('Please enter an exercise name'); return }
    state.workouts.unshift({id:Date.now(),name,duration,calories,date,time}); save(); renderAll(); clearWorkoutInputs();
  });
  $('clearWorkouts').addEventListener('click', ()=>{ if(confirm('Clear all workouts?')){ state.workouts=[]; save(); renderAll(); } });

  $('addFood').addEventListener('click', ()=>{
    const name = $('foodName').value.trim();
    let value = Number($('foodEnergy').value) || 0;
    const unit = $('foodUnit').value; const date = $('foodDate').value || todayISO(); const meal = $('foodMeal').value;
    if(!name){ alert('Please enter a food/meal name'); return }
    let kcal = unit === 'kJ' ? value * KJ_TO_KCAL : value; kcal = Math.round(kcal*10)/10;
    state.foods.unshift({id:Date.now(),name,kcal,raw:value,unit,date,meal}); save(); renderAll(); clearFoodInputs();
  });
  $('clearFood').addEventListener('click', ()=>{ if(confirm('Clear all foods?')){ state.foods=[]; save(); renderAll(); } });

  // import/export
  function exportJSON(){ const data = JSON.stringify(state,null,2); const blob = new Blob([data],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='fd-tracker-data.json'; a.click(); URL.revokeObjectURL(url); }
  function importJSON(file){ const reader = new FileReader(); reader.onload = e => { try{ const parsed = JSON.parse(e.target.result); if(parsed.foods && parsed.workouts){ state = parsed; save(); renderAll(); alert('Imported successfully'); } else alert('Invalid file'); }catch(err){ alert('Import failed: '+err.message) } }; reader.readAsText(file); }
  $('exportBtn').addEventListener('click', exportJSON); $('exportBtn2').addEventListener('click', exportJSON);
  $('importBtn').addEventListener('click', ()=>{ const t = document.createElement('input'); t.type='file'; t.accept='.json'; t.onchange = e => { const f = e.target.files[0]; if(f) importJSON(f); }; t.click(); });
  $('importBtn2').addEventListener('click', ()=>{ const t = document.createElement('input'); t.type='file'; t.accept='.json'; t.onchange = e => { const f = e.target.files[0]; if(f) importJSON(f); }; t.click(); });

  // CSV export
  $('exportCSV').addEventListener('click', ()=>{
    const day = todayISO(); const foods = state.foods.filter(f=>f.date===day); const workouts = state.workouts.filter(w=>w.date===day);
    let csv = 'type,name,meal_or_duration,energy_kcal,date\n';
    foods.forEach(f=> csv += `food,${escapeCSV(f.name)},${f.meal},${f.kcal},${f.date}\n`);
    workouts.forEach(w=> csv += `workout,${escapeCSV(w.name)},${w.duration},${w.calories},${w.date}\n`);
    const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='fd-day.csv'; a.click(); URL.revokeObjectURL(url);
  });
  function escapeCSV(s){ if(typeof s!=='string') return s; if(s.includes(',')||s.includes('"')||s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"'; return s }

  $('resetAll').addEventListener('click', ()=>{ if(confirm('Delete all data permanently?')){ state = {workouts:[], foods:[]}; save(); renderAll(); alert('Data reset'); } });

  function clearWorkoutInputs(){ $('workoutName').value=''; $('workoutDuration').value=''; $('workoutCalories').value=''; $('workoutTime').value=''; }
  function clearFoodInputs(){ $('foodName').value=''; $('foodEnergy').value=''; $('foodUnit').value='kcal'; }

  // render
  function renderWorkouts(limit=5){ const el = $('workoutList'); el.innerHTML=''; state.workouts.slice(0,limit).forEach(w=>{ const d = document.createElement('div'); d.className='entry'; d.innerHTML = `<div><div style='font-weight:600'>${escapeHtml(w.name)}</div><div class='small'>${w.date} ${w.time} • ${w.duration} min</div></div><div style='text-align:right'><div style='font-weight:700'>${w.calories} kcal</div></div>`; el.appendChild(d); }); }
  function renderFoods(limit=5){ const el = $('foodList'); el.innerHTML=''; state.foods.slice(0,limit).forEach(f=>{ const d = document.createElement('div'); d.className='entry'; d.innerHTML = `<div><div style='font-weight:600'>${escapeHtml(f.name)}</div><div class='small'>${f.date} • ${f.meal} • <span title='raw'>${f.raw}${f.unit}</span></div></div><div style='text-align:right'><div style='font-weight:700'>${f.kcal} kcal</div></div>`; el.appendChild(d); }); }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  function getTotalsForDate(date){ const ins = state.foods.filter(f=>f.date===date).reduce((a,b)=>a+b.kcal,0); const outs = state.workouts.filter(w=>w.date===date).reduce((a,b)=>a+b.calories,0); return {ins: Math.round(ins*10)/10, outs: Math.round(outs*10)/10, net: Math.round((ins-outs)*10)/10}; }

  function renderSummary(){ const day = todayISO(); const t = getTotalsForDate(day); $('calIn').innerText = `${t.ins} kcal`; $('calOut').innerText = `${t.outs} kcal`; $('calNet').innerText = `${t.net} kcal`; const last7 = lastNDates(7); let weekNet=0; last7.forEach(d=>{ const u = getTotalsForDate(d); weekNet+=u.net }); $('weekNet').innerText = `${Math.round(weekNet*10)/10} kcal`; }

  function lastNDates(n){ const arr=[]; for(let i=n-1;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); arr.push(d.toISOString().slice(0,10)); } return arr }

  // charts (simple canvas bars)
  const cCal = $('chartCalories').getContext('2d'); const cWk = $('chartWorkouts').getContext('2d');
  function drawCharts(){ const days = lastNDates(7); const ins = days.map(d=>state.foods.filter(f=>f.date===d).reduce((a,b)=>a+b.kcal,0)); const outs = days.map(d=>state.workouts.filter(w=>w.date===d).reduce((a,b)=>a+b.calories,0)); drawBar(cCal, days, ins, getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#7d7292'); drawBar(cWk, days, outs, getComputedStyle(document.documentElement).getPropertyValue('--accent-2') || '#beaabb'); }
  function drawBar(ctx, days, data, color){ const canvas = ctx.canvas; ctx.clearRect(0,0,canvas.width,canvas.height); const max = Math.max(...data, 100); ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,0.04)'; for(let i=0;i<4;i++){ const y = (canvas.height/4)*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); } const pad=18; const w = (canvas.width - pad*2)/days.length; const barW = Math.min(w*0.6,40); days.forEach((d,i)=>{ const x = pad + i*w; const h = (data[i]/max)*(canvas.height-30); ctx.fillStyle = color.trim(); ctx.fillRect(x + (w-barW)/2, canvas.height - h - 10, barW, h); ctx.fillStyle = 'rgba(246,245,247,0.9)'; ctx.font='11px Inter, Arial'; ctx.textAlign='center'; ctx.fillText(d.slice(5), x + w/2, canvas.height-2); }); }

  // show more toggles
  let foodExpanded=false; let wkExpanded=false;
  function updateRecents(){ renderFoods(foodExpanded?state.foods.length:5); renderWorkouts(wkExpanded?state.workouts.length:5); }
  $('foodShowMore').addEventListener('click', ()=>{ foodExpanded = !foodExpanded; $('foodShowMore').innerText = foodExpanded ? 'Show Less' : 'Show More'; updateRecents(); $('foodList').style.maxHeight = foodExpanded ? '500px' : '160px'; });
  $('workoutShowMore').addEventListener('click', ()=>{ wkExpanded = !wkExpanded; $('workoutShowMore').innerText = wkExpanded ? 'Show Less' : 'Show More'; updateRecents(); $('workoutList').style.maxHeight = wkExpanded ? '500px' : '160px'; });

  // theme toggle
  const body = document.body; const themeBtn = $('themeBtn'); function applyTheme(theme){ if(theme==='light'){ body.classList.add('light'); } else { body.classList.remove('light'); } localStorage.setItem('fd_theme', theme); }
  themeBtn.addEventListener('click', ()=>{ applyTheme(body.classList.contains('light') ? 'dark' : 'light'); });
  const savedTheme = localStorage.getItem('fd_theme') || 'dark'; applyTheme(savedTheme);

  // initial load & render
  load(); function renderAll(){ renderSummary(); drawCharts(); updateRecents(); }
  renderAll();

})();