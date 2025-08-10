import type { APIRoute } from "astro";
import { getSortedPosts } from "@utils/content-utils";

export const GET: APIRoute = async () => {
	try {
		const posts = await getSortedPosts();

		const searchData = posts.map((post) => ({
			url: `/posts/${post.slug}`,
			meta: {
				title: post.data.title,
				description: post.data.description || "",
			},
			excerpt: post.data.description || "",
			content:
				typeof post.body === "string" ? post.body : String(post.body || ""),
		}));

		return new Response(JSON.stringify(searchData), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error) {
		console.error("Failed to generate search data:", error);
		return new Response(
			JSON.stringify({ error: "Failed to generate search data" }),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
