import { test, expect } from '@playwright/test';
test('일정 추가·수정·삭제, 완료, 주별 저장과 새로고침',async({page})=>{
 await page.goto('/');
 await page.getByLabel('이름',{exact:true}).fill('지민');
 await page.getByRole('button',{name:'+ 항목 추가'}).click();await page.getByLabel('항목 이름').fill('독서');await page.getByRole('button',{name:'저장',exact:true}).click();
 await page.getByLabel('독서 새 할 일').fill('책 읽기');await page.getByLabel('독서 새 할 일').press('Enter');
 await page.getByLabel('할 일 수정').fill('책 한 권 읽기');await page.getByLabel('책 한 권 읽기 완료',{exact:true}).check();
 await page.getByLabel('보완할 점',{exact:true}).fill('꾸준히 기록하기\n잠 충분히 자기');
 await page.getByRole('button',{name:'월요일 07:00 일정 추가',exact:true}).click();
 await page.getByLabel('일정 제목',{exact:true}).fill('아침 독서');
 await page.getByLabel('시작 시간').selectOption('600');await page.getByLabel('종료 시간').selectOption('540');await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('늦어야');
 await page.getByLabel('시작 시간').selectOption('420');await page.getByLabel('종료 시간').selectOption('510');await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect(page.locator('.event')).toHaveCSS('height','77px');
 await page.getByRole('button',{name:'아침 독서 수정'}).click();await page.getByLabel('일정 제목',{exact:true}).fill('아침 공부');await page.getByRole('button',{name:'저장',exact:true}).click();
 await page.getByLabel('아침 공부 완료').check();await expect(page.locator('.event')).toHaveClass(/done/);
 await page.getByRole('button',{name:'다음 주',exact:true}).click();await expect(page.locator('.event')).toHaveCount(0);await expect(page.getByLabel('보완할 점',{exact:true})).toHaveValue('');await expect(page.locator('.todo-row')).toHaveCount(0);
 await page.getByLabel('보완할 점',{exact:true}).fill('다음 주 메모');await page.getByRole('button',{name:'이전 주',exact:true}).click();
 await expect(page.getByLabel('보완할 점',{exact:true})).toHaveValue('꾸준히 기록하기\n잠 충분히 자기');
 await page.reload();await expect(page.getByLabel('이름',{exact:true})).toHaveValue('지민');await expect(page.getByLabel('아침 공부 완료')).toBeChecked();await expect(page.getByLabel('책 한 권 읽기 완료')).toBeChecked();
 await page.getByLabel('아침 공부 완료').uncheck();await expect(page.locator('.event')).not.toHaveClass(/done/);
 await page.getByRole('button',{name:'아침 공부 수정'}).click();await page.getByRole('button',{name:'삭제',exact:true}).click();await expect(page.locator('.event')).toHaveCount(0);
 await page.getByLabel('책 한 권 읽기 삭제').click();await page.reload();await expect(page.locator('.todo-row')).toHaveCount(0);await expect(page.locator('.event')).toHaveCount(0);
 await page.getByRole('button',{name:'다음 주',exact:true}).click();await expect(page.getByLabel('보완할 점',{exact:true})).toHaveValue('다음 주 메모');await page.getByRole('button',{name:'이번 주',exact:true}).click();await expect(page.getByLabel('보완할 점',{exact:true})).toHaveValue('꾸준히 기록하기\n잠 충분히 자기');
});
test('자정 종료, 겹친 일정, 모바일 배치',async({page})=>{
 await page.goto('/');
 for(const title of ['야간 정리','하루 회고']){await page.getByRole('button',{name:title==='야간 정리'?'일요일 23:30 일정 추가':'일요일 23:00 일정 추가',exact:true}).click();await page.getByLabel('일정 제목',{exact:true}).fill(title);await page.getByLabel('시작 시간').selectOption('1410');await expect(page.getByLabel('종료 시간')).toHaveValue('1440');await page.getByRole('button',{name:'저장',exact:true}).click();}
 await expect(page.locator('.event')).toHaveCount(2);const boxes=await page.locator('.event').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}}));expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
test('항목별 할 일, 한 달 할 일 기간, 노션 링크',async({page})=>{
 await page.goto('/');
 // 항목(과제·프로젝트)과 그 안의 세부 할 일
 for(const name of ['과제','프로젝트']){await page.getByRole('button',{name:'+ 항목 추가'}).click();await page.getByLabel('항목 이름').fill(name);await page.getByRole('button',{name:'저장',exact:true}).click();}
 await page.getByLabel('프로젝트 새 할 일').fill('기획서 쓰기');await page.getByLabel('프로젝트 새 할 일').press('Enter');
 await page.getByLabel('프로젝트 새 할 일').fill('회의 준비');await page.getByLabel('프로젝트 새 할 일').press('Enter');
 await page.getByRole('button',{name:'과제에 할 일 추가'}).click();await page.getByLabel('과제 새 할 일').fill('수학 숙제');await page.getByLabel('과제 새 할 일').press('Enter');
 await expect(page.locator('.category').nth(1).locator('.todo-row')).toHaveCount(2);
 await page.getByLabel('기획서 쓰기 완료').check();await expect(page.locator('#todo-count')).toHaveText('1 / 3');
 // 항목 편집: 노션 링크 추가, 잘못된 주소 거부
 await page.getByRole('button',{name:'프로젝트 항목 편집'}).click();await page.locator('#category-notion').fill('javascript:alert(1)');await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.locator('#category-error')).toContainText('형식');
 await page.locator('#category-notion').fill('notion.so/my-project');await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect(page.getByRole('link',{name:'프로젝트 노션 열기'})).toHaveAttribute('href','https://notion.so/my-project');
 // 항목은 다음 주에도 남고 할 일은 비어 있음
 await page.getByRole('button',{name:'다음 주',exact:true}).click();await expect(page.locator('.category')).toHaveCount(2);await expect(page.locator('.todo-row')).toHaveCount(0);
 await page.getByRole('button',{name:'이번 주',exact:true}).click();
 // 한 달 할 일: 기간 검증, 저장, 주간 막대 표시
 const today=new Date(),idx=(today.getDay()+6)%7;
 await page.getByRole('button',{name:'+ 한 달 할 일 추가'}).click();await page.getByLabel('할 일',{exact:true}).fill('포트폴리오 완성');
 const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);await page.getByLabel('시작일').fill(iso(today));await page.getByLabel('마감일').fill(iso(yesterday));await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.locator('#goal-error')).toContainText('마감일');
 await page.getByLabel('시작일').fill(iso(today));await page.getByLabel('마감일').fill(iso(today));await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect(page.locator('.goal-row')).toHaveCount(1);await expect(page.locator('.week-goal')).toHaveText('포트폴리오 완성');await expect(page.locator('.badge')).toHaveText('D-day');
 const [bar,col]=await Promise.all([page.locator('.week-goal').boundingBox(),page.locator('.day-heading').nth(idx).boundingBox()]);
 expect(bar.x).toBeGreaterThanOrEqual(col.x);expect(bar.x+bar.width).toBeLessThanOrEqual(col.x+col.width);
 await page.getByLabel('포트폴리오 완성 완료').check();await expect(page.locator('.week-goal')).toHaveClass(/done/);
 // 전체 노션 연결
 await page.getByRole('button',{name:'노션 연결'}).click();await page.getByLabel('노션 주소').fill('https://www.notion.so/workspace');await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect(page.getByRole('link',{name:/노션 열기/}).first()).toHaveAttribute('href','https://www.notion.so/workspace');
 await page.reload();
 await expect(page.locator('#notion-open')).toBeVisible();await expect(page.getByLabel('기획서 쓰기 완료')).toBeChecked();await expect(page.locator('.goal-row.done')).toHaveCount(1);
 await expect(page.locator('.goal-title')).toHaveText('포트폴리오 완성');
});
test('이전 버전 할 일을 기본 항목으로 옮김',async({page})=>{
 await page.goto('/');
 const key=iso((()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return d;})());
 await page.evaluate(k=>localStorage.setItem('my-weekly-planner-v1',JSON.stringify({name:'지민',weeks:{[k]:{todos:[{id:'a',title:'옛 할 일',done:true}],notes:'',events:[]}}})),key);
 await page.reload();
 await expect(page.getByRole('button',{name:'할 일 항목 편집'})).toBeVisible();await expect(page.getByLabel('옛 할 일 완료')).toBeChecked();
});
