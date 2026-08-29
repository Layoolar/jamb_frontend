import { Redirect } from 'expo-router';
import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/store/auth';

/** Boot gate: decides between the sign-in screen and Home once storage is read. */
export default function Boot() {
  const status = useAuth((s) => s.status);

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  return <Redirect href={status === 'signedIn' ? '/home' : '/sign-in'} />;
}
