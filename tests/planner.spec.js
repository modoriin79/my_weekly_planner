import { test, expect } from '@playwright/test';
test('일정 추가·수정·삭제, 완료, 주별 저장과 새로고침',async({page})=>{
 await page.goto('/');
 await page.getByLabel('이름',{exact:true}).fill('지민');
 await page.getByLabel('새 할 일').fill('책 읽기');await page.getByRole('button',{name:'추가',exact:true}).click();
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
