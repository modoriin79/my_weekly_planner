import './style.css';
const $ = (id) => document.getElementById(id);
const KEY = 'my-weekly-planner-v1';
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (d,n) => { const next = new Date(d); next.setDate(next.getDate()+n); return next; };
const monday = d => addDays(new Date(d.getFullYear(),d.getMonth(),d.getDate()), -(d.getDay()+6)%7);
const time = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
let data = {name:'',weeks:{}};
let storageAvailable = true;
try { const raw = localStorage.getItem(KEY); if(raw) { const parsed = JSON.parse(raw); if(typeof parsed.name !== 'string' || !parsed.weeks || typeof parsed.weeks !== 'object') throw Error(); data = parsed; } } catch { storageAvailable = false; $('save-status').textContent = '저장 데이터를 읽을 수 없습니다. 브라우저 설정을 확인하세요.'; }
let current = monday(new Date());
let editing = null;
const week = () => data.weeks[dateKey(current)] ??= {todos:[],notes:'',events:[]};
function save(){ if(!storageAvailable) return; try { localStorage.setItem(KEY,JSON.stringify(data)); $('save-status').textContent='이 브라우저에 저장됨'; } catch { $('save-status').textContent='저장 공간이 부족하거나 저장이 차단되었습니다.'; } }
$('name').value=data.name;
$('name').addEventListener('input',e=>{data.name=e.target.value;save();});
$('notes').addEventListener('input',e=>{week().notes=e.target.value;save();});
function renderTodos(){
 const items=week().todos;
 $('todo-count').textContent=`${items.filter(t=>t.done).length} / ${items.length}`;
 $('todos').replaceChildren(...items.map(t=>{
  const li=document.createElement('li');li.className=`todo-row${t.done?' done':''}`;
  const check=document.createElement('input');check.type='checkbox';check.checked=t.done;check.setAttribute('aria-label',`${t.title} 완료`);check.onchange=()=>{t.done=check.checked;save();renderTodos();};
  const text=document.createElement('input');text.className='todo-text';text.value=t.title;text.maxLength=200;text.setAttribute('aria-label','할 일 수정');text.oninput=()=>{t.title=text.value;check.setAttribute('aria-label',`${t.title} 완료`);save();};
  const del=document.createElement('button');del.textContent='삭제';del.setAttribute('aria-label',`${t.title} 삭제`);del.onclick=()=>{week().todos=items.filter(x=>x.id!==t.id);save();renderTodos();};li.append(check,text,del);return li;
 }));
}
$('todo-form').onsubmit=e=>{e.preventDefault();const title=$('new-todo').value.trim();if(!title)return;week().todos.push({id:crypto.randomUUID(),title,done:false});$('new-todo').value='';save();renderTodos();};
function openEvent(day,start,event=null){
 editing={day,id:event?.id};$('dialog-title').textContent=event?'일정 수정':'일정 추가';const d=addDays(current,day);$('event-date').textContent=`${d.getMonth()+1}월 ${d.getDate()}일 ${weekdays[day]}요일`;
 $('event-title').value=event?.title??'';$('start-time').value=event?.start??start;$('end-time').value=event?.end??Math.min(start+60,1440);$('event-error').textContent='';$('delete-event').hidden=!event;$('event-dialog').showModal();$('event-title').focus();
}
for(let m=480;m<=1440;m+=30){if(m<1440)$('start-time').add(new Option(time(m),m));if(m>480)$('end-time').add(new Option(time(m),m));}
for(const id of ['close-dialog','cancel-event'])$(id).onclick=()=>$('event-dialog').close();
$('event-form').onsubmit=e=>{e.preventDefault();const title=$('event-title').value.trim(),start=Number($('start-time').value),end=Number($('end-time').value);if(!title){$('event-error').textContent='일정 제목을 입력해주세요.';return;}if(end<=start){$('event-error').textContent='종료 시간은 시작 시간보다 늦어야 합니다.';return;}const existing=week().events.find(x=>x.id===editing.id);if(existing)Object.assign(existing,{title,start,end});else week().events.push({id:crypto.randomUUID(),day:editing.day,title,start,end,done:false});save();renderCalendar();$('event-dialog').close();};
$('delete-event').onclick=()=>{week().events=week().events.filter(x=>x.id!==editing.id);save();renderCalendar();$('event-dialog').close();};
// Assign overlapping appointments to separate lanes so every event stays accessible.
function layout(events){const sorted=[...events].sort((a,b)=>a.start-b.start||a.end-b.end);let group=[],end=0;const result=[];function flush(){const lanes=[];for(const event of group){let lane=lanes.findIndex(x=>x<=event.start);if(lane<0)lane=lanes.length;lanes[lane]=event.end;result.push({event,lane,group});}group.count=lanes.length;}for(const event of sorted){if(group.length&&event.start>=end){flush();group=[];end=0;}group.push(event);end=Math.max(end,event.end);}if(group.length)flush();return result;}
function renderCalendar(){
 const last=addDays(current,6);$('week-range').textContent=`${current.getFullYear()}.${String(current.getMonth()+1).padStart(2,'0')}.${String(current.getDate()).padStart(2,'0')} — ${last.getFullYear()}.${String(last.getMonth()+1).padStart(2,'0')}.${String(last.getDate()).padStart(2,'0')}`;
 $('day-headings').replaceChildren(document.createElement('div'));$('days').replaceChildren();
 weekdays.forEach((day,i)=>{const d=addDays(current,i);const heading=document.createElement('div');heading.className='day-heading'+(dateKey(d)===dateKey(new Date())?' is-today':'');heading.textContent=day;const date=document.createElement('span');date.textContent=`${d.getMonth()+1}.${d.getDate()}`;heading.append(date);$('day-headings').append(heading);
 const col=document.createElement('div');col.className='day-column';for(let m=480;m<1440;m+=30){const slot=document.createElement('button');slot.className='slot';slot.setAttribute('aria-label',`${day}요일 ${time(m)} 일정 추가`);slot.onclick=()=>openEvent(i,m);col.append(slot);}
 for(const {event,lane,group} of layout(week().events.filter(e=>e.day===i))){const box=document.createElement('div');box.className='event'+(event.done?' done':'');box.style.cssText=`top:${(event.start-480)/30*40+2}px;height:${(event.end-event.start)/30*40-4}px;left:calc(${lane/group.count*100}% + 3px);width:calc(${100/group.count}% - 6px)`;
 const check=document.createElement('input');check.type='checkbox';check.checked=event.done;check.setAttribute('aria-label',`${event.title} 완료`);check.onchange=()=>{event.done=check.checked;box.classList.toggle('done',event.done);save();};
 const edit=document.createElement('button');edit.className='event-edit';edit.setAttribute('aria-label',`${event.title} 수정`);edit.onclick=()=>openEvent(i,event.start,event);const title=document.createElement('span');title.className='event-title';title.textContent=event.title;const hours=document.createElement('span');hours.className='event-time';hours.textContent=`${time(event.start)}–${time(event.end)}`;edit.append(title,hours);box.append(check,edit);col.append(box);}
 $('days').append(col);
 });
}
for(let h=8;h<=24;h++){const label=document.createElement('span');label.className='time-label';label.style.top=`${(h-8)*80}px`;label.textContent=`${String(h).padStart(2,'0')}:00`;$('time-axis').append(label);}
function render(){renderTodos();$('notes').value=week().notes;renderCalendar();}
$('prev').onclick=()=>{current=addDays(current,-7);render();};$('next').onclick=()=>{current=addDays(current,7);render();};$('today').onclick=()=>{current=monday(new Date());render();};
render();
