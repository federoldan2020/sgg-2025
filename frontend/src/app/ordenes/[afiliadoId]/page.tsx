// Server Component
import OrdenesAfiliadoClient from './page.client';

export default function Page({
  params,
}: {
  params: { afiliadoId: string }; // acá Next ya resolvió el Promise
}) {
  return <OrdenesAfiliadoClient afiliadoId={params.afiliadoId} />;
}