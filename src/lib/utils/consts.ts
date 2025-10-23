
/** used for some input fields that requires event handling after a moment instead of always  */
export const DEBOUNCE_INPUT_TIME = 333;

export type SocialVariant = 'success' | 'error' | 'warning' | 'info';

let _counter = 0;
export const randomID = () => (++_counter).toString(36);

export const EASEPICK_CORE_STYLE_v1_2_1 = '/css/easepick-core/1.2.1.css';
export const EASEPICK_AMP_STYLE_v1_2_1 = '/css/easepick-amp/1.2.1.css';
export const EASEPICK_LOCK_STYLE_v1_2_1 = '/css/easepick-lock/1.2.1.css';
export const EASEPICK_TIME_STYLE_v1_2_1 = '/css/easepick-time/1.2.1.css';
export const EASEPICK_RANGE_STYLE_v1_2_1 = '/css/easepick-range/1.2.1.css';

type ClassArgs = Record<string, boolean> | string;

export const classNames = (...classes: ClassArgs[]): string => {
	let result = '';

	for (const cls of classes) {
		if (typeof cls === 'string') {
			if (cls) result += `${cls} `;
			continue;
		}
		for (const key in cls) {
			if (cls[key]) {
				result += `${key} `;
			}
		}
	}

	return result.trim();
};
