import { useStoreValue } from "@simplestack/store/react";
import { useEffect } from "react";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { AppShell } from "./shell/AppShell";
import { loadPath, refreshFiles } from "./store/actions";
import { workspaceStore } from "./store/state";

export function App() {
	const workspace = useStoreValue(workspaceStore);
	const hasWorkspace = !!workspace.workspacePath;

	useEffect(() => {
		if (!workspace.workspacePath) return;
		void refreshFiles(workspace.workspacePath);
		const lastFile = workspace.lastOpenedPaths[workspace.workspacePath];
		if (lastFile) {
			void loadPath(lastFile);
		}
	}, [workspace.workspacePath, workspace.lastOpenedPaths]);

	if (!hasWorkspace) {
		return <WelcomeScreen onOpened={() => {}} />;
	}

	return <AppShell onSelectFile={(path) => void loadPath(path)} />;
}
