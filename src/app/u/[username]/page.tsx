import PublicProfileView from "@/components/PublicProfileView";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicProfileView username={username} />;
}
