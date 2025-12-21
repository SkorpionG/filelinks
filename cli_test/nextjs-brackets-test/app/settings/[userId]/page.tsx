export default function SettingsPage({ params }: { params: { userId: string } }) {
  return <div>Settings for user: {params.userId}</div>;
}
