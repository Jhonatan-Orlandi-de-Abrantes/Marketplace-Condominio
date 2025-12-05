window.Images = (() => {
    async function compressFile(file, maxW = 1200, quality = 0.75) {
        const img = await createImageBitmap(file);
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise(resolve => {
            canvas.toBlob(blob => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            }, 'image/jpeg', quality);
        });
    }
    async function compressFiles(files, min = 3, max = 5) {
        if (files.length < min || files.length > max) {
            throw new Error(`Selecione entre ${min} e ${max} imagens.`);
        }
        const results = [];
        for (const f of files) {
            results.push(await compressFile(f));
        }
        return results;
    }
    return { compressFiles };
})();
