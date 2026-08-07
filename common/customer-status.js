// 客户状态统一配置：状态 ID 用于存储和业务判断，label 用于页面展示。
// tagType 对应 el-tag 的内置 type（info/success/warning/danger/primary），用于列表与详情页彩色区分。
export const customerStatusOptions = [
	{ value: 'initial_contact', label: '初步沟通', className: 'tm-status-tag--initial', tagType: 'info' },
	{ value: 'communicating_positive', label: '沟通中(能转化)', className: 'tm-status-tag--positive', tagType: 'warning' },
	{ value: 'communicating_difficult', label: '沟通中(难转化)', className: 'tm-status-tag--difficult', tagType: 'warning' },
	{ value: 'invited', label: '已邀约', className: 'tm-status-tag--invited', tagType: 'primary' },
	{ value: 'converted', label: '已签单', className: 'tm-status-tag--success', tagType: 'success' },
	{ value: 'refunded', label: '已退单', className: 'tm-status-tag--refunded', tagType: 'warning' },
	{ value: 'not_interested', label: '不考虑', className: 'tm-status-tag--danger', tagType: 'danger' }
];

const legacyStatusValueMap = {
	'初步沟通': 'initial_contact',
	'沟通中(能转化)': 'communicating_positive',
	'沟通中(难转化)': 'communicating_difficult',
	'已邀约': 'invited',
	'已转化': 'converted',
	'已签单': 'converted',
	'已退单': 'refunded',
	'不考虑': 'not_interested'
};

export const normalizeCustomerStatus = (value) => legacyStatusValueMap[value] || value || 'initial_contact';

export const getCustomerStatusOption = (value) => {
	const normalizedValue = normalizeCustomerStatus(value);
	return customerStatusOptions.find((item) => item.value === normalizedValue) || customerStatusOptions[0];
};

// 云端状态配置加载后原地更新，保证已引用该数组的表单列和筛选列同步刷新。
export const applyCustomerStatusOptions = (options = []) => {
	if (!Array.isArray(options) || !options.length) return customerStatusOptions;
	const normalizedOptions = options
		.filter((item) => item && item.enabled !== false)
		.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
		.map((item) => ({
			value: item.value,
			label: item.label || item.value,
			className: item.className || `tm-status-tag--${item.value}`,
		}));
	if (!normalizedOptions.length) return customerStatusOptions;
	customerStatusOptions.splice(0, customerStatusOptions.length, ...normalizedOptions);
	return customerStatusOptions;
};
