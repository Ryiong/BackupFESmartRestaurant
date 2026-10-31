import { http, httpAll } from "./HttpClient";
import { getShopId } from "./ShopService";

const normCategory = c => ({
    id: c.id,
    name: c.name ?? '',
    description: c.description ?? '',
    active: c.status === 'ACTIVE',
});

const normProduct = (p, category) => ({
    id: p.id,
    name: p.name ?? '',
    description: p.description ?? '',
    price: Number(p.price) || 0,
    imageUrl: p.imageUrl || '',
    active: p.status === 'ACTIVE',
    categoryId: category.id,
    categoryName: category.name,
})

function toForm({ name, description, price, imageFile }) {
    const f = new FormData();
    f.append('name', name);
    f.append('description', description ?? '');
    f.append('price', String(price));
    if (imageFile) f.append('imageFile', imageFile);
    return f;
}

const collator = new Intl.Collator('vi');
const byName = (a, b) => collator.compare(a.name, b.name);

export const menuService = {
    async listMenu() {
        const shopId = await getShopId();
        const categories = (await httpAll(`/category/shop/${shopId}`)).map(normCategory).sort(byName);
        const lists = await Promise.all(categories.map(c => httpAll(`/product/category/${c.id}`)));
        const products = lists.flatMap((lisst, i) => lisst.map(p => normProduct(p, categories[i])).sort(byName));
        return { categories, products };
    },

    createProduct: (categoryId, data) => http('POST', `/product/${categoryId}`, toForm(data)),

    updateProduct: (id, data) => http('PUT' `/product/${id}`, toForm(data)),

    setProductActive: (id, active) => active
        ? http('PATCH', `/product/${id}/activate`)
        : http('DELETE', `/product/${id}`),

    async createCategory({ name, description }) {
        const shopId = await getShopId();
        return normCategory(await http('POST', `/category/${shopId}`, { name, description }));
    },

    async updateCategory(id, { name, description }) {
        return normCategory(await http('PUT', `/category/${id}`, { name, description }));
    },

    setCategoryActive: (id, active) => active
        ? http('PATCH', `/category/${id}/activate`)
        : http('DELETE', `/category/${id}`),
};