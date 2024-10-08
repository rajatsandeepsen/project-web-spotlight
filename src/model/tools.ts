import { generateText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { llama } from "./init";

const searchSite = {
    google: (topic: string) => `https://www.google.com/search?q=${topic}`,
    youtube: (topic: string) => `https://www.youtube.com/results?search_query=${topic}`,
    reddit: (topic: string) => `https://www.reddit.com/search/?type=link&q=${topic}`,
    github: (topic: string) => `https://github.com/search?q=${topic}`,
    perplexity: (topic: string) => `https://www.perplexity.ai/?q=${topic}`,
} as const

export const getTools = (model: LanguageModel, window: Window, savedURLs: string[] = []) => {

    const runTool = async (prompt: string) => {
        const tools = {
            search: tool({
                description:
                    "Search any topic or solve any doubt on specified a platform",
                parameters: z.object({
                    topic: z.string().describe("The topic or doubt to search for"),
                    platform: z.enum(
                        ["google", "youtube", "reddit", "github", "perplexity"]
                    ).default("google")
                }),
                execute: async ({ topic, platform }) => {

                    if (platform in searchSite) {
                        const url = searchSite[platform](encodeURIComponent(topic))

                        window.open(url, '_blank')
                        return `Searching "${topic}" on ${platform}`
                    }
                    return `Platform support "${platform}" is not available`

                },

            }),
            AI: tool({
                description:
                    "AI tool to generate explaination of a topic",
                parameters: z.object({
                    topic: z.string().describe("The topic to explain")
                }),
                execute: async ({ topic }) => {
                    const system = "You are a personal assistant who like to answer the questions or explain from user topic"
                    const prompt = `topic: ${topic}`

                    const text = await generateText({
                        model: llama,
                        prompt,
                        system,
                    })

                    return {
                        system,
                        prompt,
                        response: text.text
                    }
                },
            }),

            openWebsite: tool({
                description: "Create or open multiple tabs of websites",
                parameters: z.object({
                    websites: z.array(
                        z.string()
                            .describe("The name of website (including domain suffix if mentioned)")
                    ).min(1).max(4),
                    incognito: z.boolean().optional().default(false).describe("Open tabs in incognito or private mode")
                }),
                execute: async ({ websites, incognito }) => {
                    const isURL = z.array(z.string().url()).safeParse(websites)
                    if (isURL.success) {
                        window.tabs.addTabs([isURL.data]);
                    } else {
                        const convertedURLs = websites.map(site => {
                            if (site.match(/\.[a-z]{2,}$/i)) {
                                // If the string contains a domain suffix, add https://
                                return `https://${site}`;
                            }

                            // Search the name in the array of presaved website links
                            const match = savedURLs.find(preset =>
                                preset.includes(site.toLowerCase())
                            );
                            return match ? match : `https://www.google.com/search?q=${encodeURIComponent(site)}`;

                        });
                        window.tabs.addTabs([convertedURLs]);
                    }
                    return `Creating new ${websites.length}x ${incognito ? "private " : ""}tabs ${websites.join(", ")}`
                }
            }),

            openTerminal: tool({
                description: "Open a single terminal or command line tool",
                parameters: z.object({}),
                execute: async () => "Opening terminal"
            }),

            showSection: tool({
                description: "Open any section",
                parameters: z.object({
                    section: z.enum(["downloads", "settings", "history", "bookmarks", "extensions", "home"]).default("home")
                }),
                execute: async ({ section }) => `Opening ${section}`

            }),

            clearData: tool({
                description: "Clear any data, or reset any settings",
                parameters: z.object({
                    section: z.enum(["all", "tabs", "settings", "history", "", "extensions", "home"]).default("home")
                }),
                execute: async ({ section }) => `Opening ${section}`
            }),

            openFile: tool({
                description: "Search any files on computer",
                parameters: z.object({
                    folderPath: z.string().trim().optional().describe("The path to search for files"),
                    fileName: z.string().trim().optional().describe("The name of file to search")
                }),
                execute: async ({ fileName, folderPath }) => {
                    if (!fileName && !folderPath)
                        throw new Error("Please mention file or folder name to start searching")

                    const founds: object[] = []

                    if (folderPath) {
                        const newFolderPath = folderPath.split(/[/\\]/).pop() ?? folderPath
                        const ls = window.fs.listDir(newFolderPath, true)
                        if (fileName) {
                            ls.forEach(e => {
                                if (e.isDir) {
                                    const gotHim = e.dirs.find(f => f.path.includes(fileName))
                                    if (gotHim) founds.push(gotHim)
                                    return
                                }

                                if (e.path.includes(fileName)) founds.push(e)
                            })
                        }
                        else {
                            ls.forEach(e => {
                                if (e.isDir) {
                                    const gotHim = e.path.includes(folderPath)
                                    if (gotHim) founds.push(e)
                                    return
                                }
                            })
                        }
                    }
                    else {
                        if (!fileName) throw new Error("Please mention file or folder name to start searching")
                        const newFileName = fileName.includes(".") ? fileName.split(".")[0] : fileName
                        const ls = window.fs.listDir(newFileName, true)

                        ls.forEach(e => {
                            if (e.isDir) {
                                const gotHim = e.dirs.find(f => f.path.includes(newFileName))
                                if (gotHim) founds.push(gotHim)
                                return
                            }

                            if (e.path.includes(newFileName)) founds.push(e)
                        })
                    }

                    if (founds.length === 0) throw new Error("Not Found any file/folder matching the labels")

                    return founds

                    // return `Opening ${fileName ?? "a file"} on path: ${folderPath ?? "unknown"}`
                }
            }),

        }

        const response = await generateText({
            model: model,
            prompt,
            toolChoice: "required",
            system:
                "You are a personal assistant inside a browser that has access to various tools and functionalities",
            tools
        });

        return {response, tools}
    };

    return runTool
}
// const res = await runTool("open file my-pdf.pdf from workspace folder");
// console.log(res.toolResults);
