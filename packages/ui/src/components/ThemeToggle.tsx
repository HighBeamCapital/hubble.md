import MingcuteMonitorLine from "~icons/mingcute/monitor-line";
import MingcuteMoonLine from "~icons/mingcute/moon-line";
import MingcuteSunLine from "~icons/mingcute/sun-line";
import type { Theme } from "../lib/theme";
import { useTheme } from "../lib/theme";
import { Button } from "../primitives/button";

const THEME_ICONS: Record<Theme, typeof MingcuteSunLine> = {
	light: MingcuteSunLine,
	dark: MingcuteMoonLine,
	system: MingcuteMonitorLine,
};

const THEME_LABELS: Record<Theme, string> = {
	light: "Light mode",
	dark: "Dark mode",
	system: "System theme",
};

export function ThemeToggle() {
	const { theme, cycleTheme } = useTheme();
	const Icon = THEME_ICONS[theme];

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={cycleTheme}
			aria-label={THEME_LABELS[theme]}
			title={THEME_LABELS[theme]}
		>
			<Icon className="size-4" />
		</Button>
	);
}
