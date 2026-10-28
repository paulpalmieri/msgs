import { DataProvider, useData } from './app/DataProvider';
import { useRoute } from './app/router';
import { ConversationPage } from './pages/ConversationPage';
import { ImportPage } from './pages/ImportPage';
import { PickerPage } from './pages/PickerPage';
import { MediaProvider } from './media/MediaProvider';

function Root() {
  const { state } = useData();
  const [route, navigate] = useRoute();
  if (state.status === 'booting') return <div className="flex h-full items-center justify-center text-ink-3">Starting database…</div>;
  if (state.status !== 'ready') return <ImportPage />;
  if (route.view === 'conversation') return <ConversationPage key={route.threadId} route={route} navigate={navigate} />;
  return <PickerPage navigate={navigate} />;
}

export function App() {
  return (
    <DataProvider>
      <MediaProvider>
        <Root />
      </MediaProvider>
    </DataProvider>
  );
}
