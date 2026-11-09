// 앱 창의 요청을 기록하고, 화면에서 외부 주소 fetch 를 시도해 거절되는지 보는 도우미.
// Playwright 는 앱 창의 요청만 본다. Chromium 프로세스 자체의 요청(DNS 선조회 등)은 보이지 않는다 (01-tech-stack.md).

import type { Page } from '@playwright/test'

export type ObservedRequest = { url: string; method: string; resourceType: string }
export type ObservedResponse = { url: string; status: number }
export type ObservedFailure = { url: string; errorText: string }

export type RequestObserver = {
  requests: ObservedRequest[]
  responses: ObservedResponse[]
  failures: ObservedFailure[]
  /** 조건에 맞는 주소로 받은 응답. 차단되었으면 비어 있다. */
  responsesFor: (match: (url: string) => boolean) => ObservedResponse[]
  /** 관찰을 끝낸다. */
  stop: () => void
}

/** 창의 요청·응답·실패를 기록하기 시작한다. */
export function observeRequests(page: Page): RequestObserver {
  const requests: ObservedRequest[] = []
  const responses: ObservedResponse[] = []
  const failures: ObservedFailure[] = []

  const onRequest = (request: { url(): string; method(): string; resourceType(): string }): void => {
    requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() })
  }
  const onResponse = (response: { url(): string; status(): number }): void => {
    responses.push({ url: response.url(), status: response.status() })
  }
  const onFailed = (request: { url(): string; failure(): { errorText: string } | null }): void => {
    failures.push({ url: request.url(), errorText: request.failure()?.errorText ?? '' })
  }

  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfailed', onFailed)

  return {
    requests,
    responses,
    failures,
    responsesFor: (match) => responses.filter((response) => match(response.url)),
    stop: () => {
      page.off('request', onRequest)
      page.off('response', onResponse)
      page.off('requestfailed', onFailed)
    },
  }
}

export type FetchAttempt = { rejected: boolean; message: string }

/** 화면 안에서 fetch(url)을 실행한다. 거절(네트워크 오류)이면 rejected 가 true. */
export async function tryExternalFetch(page: Page, url: string): Promise<FetchAttempt> {
  return page.evaluate(async (target: string): Promise<FetchAttempt> => {
    const run = (globalThis as unknown as { fetch: (input: string) => Promise<unknown> }).fetch
    try {
      await run(target)
      return { rejected: false, message: '' }
    } catch (error) {
      return { rejected: true, message: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
    }
  }, url)
}
