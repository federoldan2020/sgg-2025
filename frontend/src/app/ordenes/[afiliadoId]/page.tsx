// Server Component
import OrdenesAfiliadoClient from './page.client';

export default async function Page({
  params,
}: {
  params: Promise<{ afiliadoId: string }>;
}) {
  const { afiliadoId } = await params;
  return <OrdenesAfiliadoClient afiliadoId={afiliadoId} />;
}