import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = 'stock-post-9';
  
  const post = await prisma.post.findFirst({
    where: { slug },
    include: {
      menu: true,
      author: true,
    }
  });
  
  if (post) {
    console.log('Post found:', {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      menuSlug: post.menu.slug,
      author: post.author.email,
    });
  } else {
    console.log('Post not found with slug:', slug);
  }
  
  // List all posts with stock category
  const stockMenu = await prisma.menu.findUnique({
    where: { slug: 'stock' }
  });
  
  if (stockMenu) {
    const stockPosts = await prisma.post.findMany({
      where: { menuId: stockMenu.id },
      select: { id: true, slug: true, title: true }
    });
    
    console.log('\nAll stock posts:');
    stockPosts.forEach(p => console.log(`- ${p.slug}: ${p.title}`));
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });