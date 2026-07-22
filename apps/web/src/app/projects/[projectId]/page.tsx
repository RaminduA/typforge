import { TypforgeShell } from "@/components/workspace/TypforgeShell";

interface ProjectWorkspacePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectWorkspacePage({
  params
}: ProjectWorkspacePageProps) {
  const { projectId } = await params;

  return <TypforgeShell projectId={projectId} />;
}