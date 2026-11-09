# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistence.spec.ts >> persistence >> TC-110 변경한 뒤 정상 종료하고 다시 열면 카드, 상태, 기록이 그대로 보인다
- Location: tests\browser\persistence.spec.ts:101:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('dialog.card-dialog')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('dialog.card-dialog') with timeout 5000ms
  - waiting for locator('dialog.card-dialog')
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Test source

```ts
  11  | import type { LaunchedApp } from './launch-app'
  12  | 
  13  | /** 실행하는 날(PC 현지)의 날짜. 앱의 `todayLocal(new Date())`와 같은 계산이다. */
  14  | export function today(): string {
  15  |   return todayLocal(new Date())
  16  | }
  17  | 
  18  | export function daysFromToday(n: number): string {
  19  |   return addDays(today(), n)
  20  | }
  21  | 
  22  | /** 카드 id 를 순번에서 만든다. */
  23  | export function cardId(n: number): string {
  24  |   return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  25  | }
  26  | 
  27  | export function entryId(n: number): string {
  28  |   return `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`
  29  | }
  30  | 
  31  | export function seedCard(n: number, overrides: Partial<Card> = {}): Card {
  32  |   return makeCard({ id: cardId(n), title: `카드${n}`, ...overrides })
  33  | }
  34  | 
  35  | export function seedEntry(n: number, forCard: number, overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  36  |   return makeEntry({ id: entryId(n), cardId: cardId(forCard), content: `기록${n}`, ...overrides })
  37  | }
  38  | 
  39  | /** 현재 버전 저장 문서의 JSON. */
  40  | export function seedJson(cards: Card[], progressEntries: ProgressEntry[] = []): string {
  41  |   return JSON.stringify(makeDoc({ cards, progressEntries }), null, 2)
  42  | }
  43  | 
  44  | /** 첫 화면(Bootstrap 이 목록을 받고 AppShell 을 그린 뒤)을 기다린다. */
  45  | export async function waitForBoard(page: Page): Promise<void> {
  46  |   await page.locator('.app-shell').waitFor()
  47  | }
  48  | 
  49  | export function column(page: Page, status: Status): Locator {
  50  |   return page.locator(`section.column[data-status="${status}"]`)
  51  | }
  52  | 
  53  | export function boardCard(page: Page, title: string): Locator {
  54  |   return page.locator('.card-item', { hasText: title })
  55  | }
  56  | 
  57  | export function dialog(page: Page): Locator {
  58  |   return page.locator('dialog.card-dialog')
  59  | }
  60  | 
  61  | export function createButton(page: Page): Locator {
  62  |   return page.locator('.top-bar__create')
  63  | }
  64  | 
  65  | export function titleInput(page: Page): Locator {
  66  |   return dialog(page).getByRole('textbox', { name: /^제목/ })
  67  | }
  68  | 
  69  | /** 대화상자의 상태 선택 목록. */
  70  | export function statusSelect(page: Page): Locator {
  71  |   return dialog(page).getByLabel('상태', { exact: true })
  72  | }
  73  | 
  74  | /** 사이드바 저장 상태 글자. */
  75  | export function saveIndicator(page: Page): Locator {
  76  |   return page.locator('.sidebar-save')
  77  | }
  78  | 
  79  | export async function openCreateDialog(page: Page): Promise<void> {
  80  |   await createButton(page).click()
  81  |   await expect(dialog(page)).toBeVisible()
  82  | }
  83  | 
  84  | export async function clickSave(page: Page): Promise<void> {
  85  |   await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  86  | }
  87  | 
  88  | export type NewCardFields = {
  89  |   title: string
  90  |   kind?: '개발 버그' | '할 일'
  91  |   /** 새 카드의 처음 상태. 생략하면 선택을 건드리지 않는다(처음 선택은 할 일). */
  92  |   status?: '할 일' | '진행 중'
  93  |   dueDate?: string
  94  |   description?: string
  95  |   priority?: '없음' | '낮음' | '중간' | '높음'
  96  |   memo?: string
  97  | }
  98  | 
  99  | /** `카드 만들기`로 대화상자를 열어 입력하고 `저장`까지 누른다. 닫히는 것까지 기다린다. */
  100 | export async function createCardViaDialog(page: Page, fields: NewCardFields): Promise<void> {
  101 |   await openCreateDialog(page)
  102 |   await titleInput(page).fill(fields.title)
  103 |   const box = dialog(page)
  104 |   if (fields.kind !== undefined) await box.getByRole('radio', { name: fields.kind, exact: true }).click()
  105 |   if (fields.status !== undefined) await statusSelect(page).selectOption({ label: fields.status })
  106 |   if (fields.dueDate !== undefined) await box.getByRole('textbox', { name: /^마감일/ }).fill(fields.dueDate)
  107 |   if (fields.priority !== undefined) await box.getByRole('radio', { name: fields.priority, exact: true }).click()
  108 |   if (fields.description !== undefined) await box.getByRole('textbox', { name: '상세 설명' }).fill(fields.description)
  109 |   if (fields.memo !== undefined) await box.getByRole('textbox', { name: '추가 메모' }).fill(fields.memo)
  110 |   await clickSave(page)
> 111 |   await expect(dialog(page)).toHaveCount(0)
      |                              ^ Error: expect(locator).toHaveCount(expected) failed
  112 | }
  113 | 
  114 | /** 카드를 눌러 상세 대화상자를 연다. */
  115 | export async function openCardDialog(page: Page, title: string): Promise<void> {
  116 |   await boardCard(page, title).locator('.card-item__title').click()
  117 |   await expect(dialog(page)).toBeVisible()
  118 |   await expect(dialog(page).locator('.card-dialog__title')).toHaveText('카드 상세')
  119 | }
  120 | 
  121 | export async function closeDialogWithCancel(page: Page): Promise<void> {
  122 |   await dialog(page).getByRole('button', { name: '취소', exact: true }).click()
  123 |   await expect(dialog(page)).toHaveCount(0)
  124 | }
  125 | 
  126 | /** 카드의 `⋯` 메뉴를 열어 항목 글자 목록을 돌려준다 (메뉴는 열린 채로 둔다). */
  127 | export async function openMoveMenu(page: Page, title: string): Promise<string[]> {
  128 |   await boardCard(page, title).locator('.card-move-btn').click()
  129 |   const menu = page.getByRole('menu', { name: '상태 이동' })
  130 |   await expect(menu).toBeVisible()
  131 |   return menu.getByRole('menuitem').allTextContents()
  132 | }
  133 | 
  134 | export async function moveViaMenu(page: Page, title: string, itemLabel: string): Promise<void> {
  135 |   await openMoveMenu(page, title)
  136 |   await page.getByRole('menuitem', { name: itemLabel, exact: true }).click()
  137 | }
  138 | 
  139 | /** 저장 파일을 읽어 JSON 으로 돌려준다. 없으면 오류. */
  140 | export async function readDoc(dir: string): Promise<{ cards: Card[]; progressEntries: ProgressEntry[] }> {
  141 |   const text = await readDataFile(dir)
  142 |   if (text === null) throw new Error('저장 파일이 없다')
  143 |   return JSON.parse(text) as { cards: Card[]; progressEntries: ProgressEntry[] }
  144 | }
  145 | 
  146 | /**
  147 |  * 같은 데이터 폴더로 앱을 여러 번 구동하는 시험용. 폴더는 이 함수가 만들고 끝나면 지운다.
  148 |  * `launch`는 앞 구동을 닫은 뒤 다음 구동을 띄운다 (한 번에 하나만 떠 있다).
  149 |  */
  150 | export async function withPersistentDir<T>(
  151 |   initialJson: string | undefined,
  152 |   body: (ctx: {
  153 |     dir: string
  154 |     launch: () => Promise<LaunchedApp>
  155 |     close: (app: LaunchedApp) => Promise<void>
  156 |   }) => Promise<T>,
  157 | ): Promise<T> {
  158 |   const dir = await makeTempDir()
  159 |   let first = true
  160 |   const running: LaunchedApp[] = []
  161 |   try {
  162 |     return await body({
  163 |       dir,
  164 |       launch: async () => {
  165 |         const options =
  166 |           first && initialJson !== undefined ? { userDataDir: dir, seedJson: initialJson } : { userDataDir: dir }
  167 |         first = false
  168 |         const launched = await launchApp(options)
  169 |         running.push(launched)
  170 |         await waitForBoard(launched.page)
  171 |         return launched
  172 |       },
  173 |       close: async (app) => {
  174 |         const index = running.indexOf(app)
  175 |         if (index >= 0) running.splice(index, 1)
  176 |         await closeApp(app)
  177 |       },
  178 |     })
  179 |   } finally {
  180 |     for (const app of running) await closeApp(app)
  181 |     await removeDir(dir)
  182 |   }
  183 | }
  184 | 
```