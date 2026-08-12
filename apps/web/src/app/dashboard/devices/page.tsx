import PageContainer from '@/components/layout/page-container';
import { DeviceListing } from '@/features/devices/components/device-listing';

export const metadata = {
  title: 'Dashboard: Devices',
};

export default function Page() {
  return (
    <PageContainer scrollable={false} pageTitle='Devices' pageDescription='All device assets in this VPP fleet.'>
      <DeviceListing />
    </PageContainer>
  );
}
