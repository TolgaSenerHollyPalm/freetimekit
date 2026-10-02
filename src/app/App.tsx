import ConnectionNotice from 'kitshelf-ui/app/ConnectionNotice.tsx'
import toast from 'kitshelf-ui/app/toast.module.css'
import { ToastProvider, Toasts } from 'kitshelf-ui/ui/Toast.tsx'
import { useEffect } from 'react'
import { KIT_NAME } from '../kit.ts'
import AnswersScreen from '../screens/AnswersScreen.tsx'
import CardScreen from '../screens/CardScreen.tsx'
import DoneScreen from '../screens/DoneScreen.tsx'
import HomeScreen from '../screens/HomeScreen.tsx'
import QuizScreen from '../screens/QuizScreen.tsx'
import SettingsScreen from '../screens/SettingsScreen.tsx'
import TableDoneScreen from '../screens/TableDoneScreen.tsx'
import TableScreen from '../screens/TableScreen.tsx'
import TableSetupScreen from '../screens/TableSetupScreen.tsx'
import TopicsScreen from '../screens/TopicsScreen.tsx'
import WeekendScreen from '../screens/WeekendScreen.tsx'
import WelcomeScreen from '../screens/WelcomeScreen.tsx'
import { useAppData } from './appData.ts'
import AppDataProvider from './AppDataProvider.tsx'
import { href, navigate, redirect, useRoute, type Route } from './router.ts'
import UpdatePrompt from './UpdatePrompt.tsx'

export default function App() {
  return (
    <ToastProvider>
      <AppDataProvider>
        <Routes />
      </AppDataProvider>
      <div className={toast.stack}>
        <UpdatePrompt />
        <ConnectionNotice appName={KIT_NAME} />
        <Toasts />
      </div>
    </ToastProvider>
  )
}

/** The screen for the address, or for where an address that does not fit the data has to go (plan 6). */
function Routes() {
  const requested = useRoute()
  const { settings, progress, table } = useAppData()
  const target = redirect(requested, { hasSettings: (settings?.interests.length ?? 0) > 0, progress, table })
  const route = target ?? requested
  const address = href(route)

  useEffect(() => {
    if (target) navigate(target, { replace: true })
  }, [target])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [address])

  // Keyed by address so a screen starts fresh whenever the route changes.
  return <CurrentScreen key={address} route={route} />
}

function CurrentScreen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'home':
      return <HomeScreen />
    case 'welcome':
      return <WelcomeScreen />
    case 'settings':
      return <SettingsScreen />
    case 'card':
      return <CardScreen cardId={route.cardId} />
    case 'quiz':
      return <QuizScreen cardId={route.cardId} />
    case 'done':
      return <DoneScreen cardId={route.cardId} />
    case 'answers':
      return <AnswersScreen cardId={route.cardId} />
    case 'topics':
      return <TopicsScreen />
    case 'weekend':
      return <WeekendScreen />
    case 'table-new':
      return <TableSetupScreen />
    case 'table':
      return <TableScreen />
    case 'table-done':
      return <TableDoneScreen />
  }
}
