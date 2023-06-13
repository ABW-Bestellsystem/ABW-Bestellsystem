import fs from "fs/promises";
import hbs from "handlebars";
import puppeteer from "puppeteer";

import MenuModel, { IMenuSchema } from "../../models/menuModel";
import PDFModel, { IpdfSchema } from "../../models/pdfModel";
import SiteSettingsModel, { MenuAdditions } from "../../models/siteSettingsModel";
import UserModel, { IorderSchema } from "../../models/userModel";

interface Icomment {
	count: number;
	order: Array<string>;
}

interface InewOrder {
	[x: string]: any;
	price: number;
	name: string;
	normal: {
		quantity: 0;
		ketchup: 0;
		mustard: 0;
		sweetMustard: 0;
		comments: Array<Icomment>;
	};
	multigrain: {
		quantity: 0;
		ketchup: 0;
		mustard: 0;
		sweetMustard: 0;
		comments: Array<Icomment>;
	};
}

function formatToCurrent(number: number) {
	return Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: "EUR",
	}).format(number);
}

async function generatePDF(userrank: string, siteID?: string) {
	const browser = await puppeteer.launch({
		headless: "new",
		args: [
			"--no-sandbox", 
			"--disable-setuid-sandbox",
		],
	});
	const page = await browser.newPage();

	const content = await compile("Bestellliste_HBS", await getAllOrders(userrank, siteID));

	await page.setContent(content);
	await page.emulateMediaType("screen");
	const pdf = await page.pdf({
		//path: "mypdf.pdf",
		landscape: true,
		format: "a4",
		printBackground: true,
	});

	await browser.close();

	return pdf;
}
/**
 *
 * @param userID from a user
 * @returns current rank
 */
async function getUserRank(userID: string) {
	return (await UserModel.findById({ _id: userID }).select("rank"))?.rank;
}

async function compile(templateName: string, data: any) {
	//TODO: Zu relativem Pfad ändern
	const filepath = `src/handlebarPages/${templateName}.hbs`;

	const html = await fs.readFile(filepath, { encoding: "utf-8" });

	return hbs.compile(html)(data);
}

async function getAllOrders(rank: string, siteID?: string): Promise<any> {
	let neworderlist: InewOrder[] = [];
	const menuFilter = siteID ? { siteID: siteID } : {};
	const additionFilter = siteID ? { _id: siteID } : {};

	const menuitems: Array<IMenuSchema> = await MenuModel.find(menuFilter).sort({ index: 1});

	let menuAdditions: (MenuAdditions | undefined)[] = (
		await SiteSettingsModel.find(additionFilter).select("menuAdditions")
	)
		.map((item) => item.menuAdditions)
		.flat(1);

	menuitems.forEach((menuitem: IMenuSchema) => {
		neworderlist.push({
			price: menuitem.price,
			name: menuitem.name,
			comments: [],
			normal: {
				quantity: 0,
				ketchup: 0,
				mustard: 0,
				sweetMustard: 0,
				comments: [],
			},
			multigrain: {
				quantity: 0,
				ketchup: 0,
				mustard: 0,
				sweetMustard: 0,
				comments: [],
			},
		});
	});

	// find all usersorders (multiple arrays), map them in one array (arrays in array) and merge orders (merge arrays)
	const userorders: Array<IorderSchema> = (
		await UserModel.find({ rank: rank }).select("order")
	)
		.map((item) => {
			return item.order;
		})
		.flat(1)
		.filter((item) => item.siteID.toString() === siteID);

	userorders.forEach((order: IorderSchema) => {
		const neworderlistitem: InewOrder = neworderlist.filter((item) => {
			return item.name === order.name;
		})[0];

		// Happens if a User has ordered an Item that was deleted from the menu
		if (neworderlistitem === undefined) return {};

		neworderlistitem[order.bread].comments.push({
			count: order.quantity,
			order: order.comment,
		});

		neworderlistitem[order.bread].quantity! += order.quantity;

		neworderlistitem[order.bread].ketchup! += order.sauce.ketchup;
		neworderlistitem[order.bread].mustard! += order.sauce.mustard;
		neworderlistitem[order.bread].sweetMustard! += order.sauce.sweetMustard;
	});

	let total: number = 0;

	neworderlist.forEach((item: InewOrder) => {
		total =
			total +
			item.multigrain.quantity * item.price +
			item.normal.quantity * item.price;

		//Check if menuAdditions exist (created by the editor)
		if (menuAdditions[0]) {
			total =
				total +
				item.multigrain.comments.reduce((firstval, secval) => {
					return (
						firstval +
						secval.order.reduce((lastcomment, currcomment) => {
							return (
								lastcomment +
								(menuAdditions.find(
									(additions) =>
										//@ts-ignore
										additions.name ===
										currcomment
								)?.price || 0) *
									secval.count
							);
						}, 0)
					);
				}, 0) +
				item.normal.comments.reduce((firstval, secval) => {
					return (
						firstval +
						secval.order.reduce((lastcomment, currcomment) => {
							return (
								lastcomment +
								(menuAdditions.find(
									(additions) =>
										//@ts-ignore
										additions.name ===
										currcomment
								)?.price || 0) *
									secval.count
							);
						}, 0)
					);
				}, 0);
		}
	});

	const pdfsettings: IpdfSchema | null = await PDFModel.findOne({ rank: rank });

	if (pdfsettings)
		return {
			rank: rank,
			date: `${new Date().toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			})}`,
			total: formatToCurrent(total),
			phone: pdfsettings.phone,
			pickUp: pdfsettings.pickUp,
			menuitem: neworderlist,
		};
	else {
		return {};
	}
}

export { getAllOrders, formatToCurrent, compile, InewOrder, generatePDF, getUserRank };

