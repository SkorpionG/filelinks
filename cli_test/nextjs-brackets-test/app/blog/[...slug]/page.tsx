export default function BlogPage({ params }: { params: { slug: string[] } }) {
  return <div>Blog: {params.slug.join('/')}</div>;
}
