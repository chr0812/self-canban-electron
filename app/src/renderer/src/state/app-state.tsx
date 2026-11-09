import { createContext, useCallback, useContext, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { dataReducer, initialDataState, initialSaveState, initialUiState, saveReducer, uiReducer } from './reducers'
import { isDataAction, isSaveAction, isUiAction } from './state-types'
import type { Action, DataState, SaveState, UiState } from './state-types'

// Context 세 개(DataState, UiState, SaveState)와 Provider, 훅 (ADR-006).
// 검색어 입력처럼 UiState 만 바뀔 때 데이터를 쓰는 컴포넌트가 다시 그려지지 않게 나눈다.
// 상태를 바꾸는 쪽은 ChangeRunner 와 Bootstrap 뿐이다. 다른 컴포넌트는 읽기만 한다.

const DataContext = createContext<DataState | null>(null)
const UiContext = createContext<UiState | null>(null)
const SaveContext = createContext<SaveState | null>(null)
const DispatchContext = createContext<Dispatch<Action> | null>(null)

export interface AppStateProviderProps {
  children: ReactNode
  /** 시험·Bootstrap 이 처음 값을 정할 때 쓴다. 없으면 빈 보드, 어두운 판, 오늘 기준의 월 보기다. */
  initialData?: DataState
  initialUi?: UiState
  initialSave?: SaveState
}

export function AppStateProvider({ children, initialData, initialUi, initialSave }: AppStateProviderProps) {
  const [data, dispatchData] = useReducer(dataReducer, initialData, (value) => value ?? initialDataState())
  const [ui, dispatchUi] = useReducer(uiReducer, initialUi, (value) => value ?? initialUiState())
  const [save, dispatchSave] = useReducer(saveReducer, initialSave, (value) => value ?? initialSaveState())

  // 액션 이름 앞부분(data/, ui/, save/)으로 맞는 reducer 에 보낸다. 함수 모양이 변하지 않아 쓰는 쪽이 다시 그려지지 않는다.
  const dispatch = useCallback((action: Action) => {
    if (isDataAction(action)) dispatchData(action)
    else if (isUiAction(action)) dispatchUi(action)
    else if (isSaveAction(action)) dispatchSave(action)
  }, [])

  return (
    <DispatchContext value={dispatch}>
      <DataContext value={data}>
        <UiContext value={ui}>
          <SaveContext value={save}>{children}</SaveContext>
        </UiContext>
      </DataContext>
    </DispatchContext>
  )
}

function required<T>(value: T | null, hook: string): T {
  if (value === null) throw new Error(`${hook}() 는 AppStateProvider 안에서만 쓸 수 있습니다.`)
  return value
}

export function useData(): DataState {
  return required(useContext(DataContext), 'useData')
}

export function useUi(): UiState {
  return required(useContext(UiContext), 'useUi')
}

export function useSaveState(): SaveState {
  return required(useContext(SaveContext), 'useSaveState')
}

/** 세 reducer 에 액션을 보낸다. 화면 컴포넌트는 UiAction 만 보낸다 (data/·save/ 는 ChangeRunner 와 Bootstrap). */
export function useDispatch(): Dispatch<Action> {
  return required(useContext(DispatchContext), 'useDispatch')
}
