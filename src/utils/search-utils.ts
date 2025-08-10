import type { SearchResult } from "@/global";

let searchData: SearchResult[] | null = null;

// 初始化搜索数据
export async function initializeSearchData(): Promise<SearchResult[]> {
	if (searchData) {
		return searchData;
	}

	try {
		const response = await fetch("/api/search-data.json");
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		searchData = await response.json();
		return searchData || [];
	} catch (error) {
		console.error("Failed to initialize search data:", error);
		return [];
	}
}

// 搜索函数
export async function searchPosts(keyword: string): Promise<SearchResult[]> {
	if (!keyword.trim()) {
		return [];
	}

	const data = await initializeSearchData();
	const searchTerm = keyword.toLowerCase();

	const results = data.filter((item) => {
		const titleMatch = item.meta.title.toLowerCase().includes(searchTerm);
		const descriptionMatch =
			item.meta.description?.toLowerCase().includes(searchTerm) || false;
		const contentMatch =
			item.content?.toLowerCase().includes(searchTerm) || false;
		return titleMatch || descriptionMatch || contentMatch;
	});

	// 为搜索结果生成高亮摘录和标题
	return results.map((item) => {
		const titleMatch = item.meta.title.toLowerCase().includes(searchTerm);
		const highlightedExcerpt = generateHighlightedExcerpt(item, searchTerm);

		return {
			...item,
			meta: {
				...item.meta,
				title: titleMatch
					? highlightText(item.meta.title, searchTerm, 100)
					: item.meta.title,
			},
			excerpt: highlightedExcerpt,
		};
	});
}

// 生成高亮摘录
function generateHighlightedExcerpt(
	item: SearchResult,
	searchTerm: string,
): string {
	const maxLength = 150;

	if (
		item.meta.description &&
		item.meta.description.toLowerCase().includes(searchTerm)
	) {
		return highlightText(item.meta.description, searchTerm, maxLength);
	}

	if (item.content) {
		const content = item.content.toLowerCase();
		const termIndex = content.indexOf(searchTerm);

		if (termIndex !== -1) {
			// 提取关键词周围的文本
			const start = Math.max(0, termIndex - 50);
			const end = Math.min(content.length, termIndex + searchTerm.length + 50);
			const excerpt = item.content.substring(start, end);

			return highlightText(excerpt, searchTerm, maxLength);
		}
	}

	return item.meta.description || "No description available.";
}

// 高亮文本中的关键词
function highlightText(
	text: string,
	searchTerm: string,
	maxLength: number,
): string {
	let result = text;

	if (result.length > maxLength) {
		result = result.substring(0, maxLength) + "...";
	}

	const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, "gi");
	result = result.replace(regex, "<mark>$1</mark>");

	return result;
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 清除搜索数据缓存
export function clearSearchCache(): void {
	searchData = null;
}
