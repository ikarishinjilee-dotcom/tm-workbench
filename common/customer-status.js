// 客户状态统一配置：状态 ID 用于存储和业务判断，label 用于页面展示。
export const customerStatusOptions = [
	{ value: 'initial_contact', label: '初步沟通', className: 'tm-status-tag--initial' },
	{ value: 'communicating_positive', label: '沟通中(能转化)', className: 'tm-status-tag--positive' },
	{ value: 'communicating_difficult', label: '沟通中(难转化)', className: 'tm-status-tag--difficult' },
	{ value: 'invited', label: '已邀约', className: 'tm-status-tag--invited' },
	{ value: 'converted', label: '已签单', className: 'tm-status-tag--success' },
	{ value: 'refunded', label: '已退单', className: 'tm-status-tag--refunded' },
	{ value: 'not_interested', label: '不考虑', className: 'tm-status-tag--danger' }
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
