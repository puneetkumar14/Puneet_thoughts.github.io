import { connectToDB } from '../../lib/db';
import { verifyToken } from '../../lib/auth';
import Post from '../../models/Post';

export default async function handler(req, res) {
  const { method } = req;

  try {
    await connectToDB();

    switch (method) {
      case 'GET': {
        const { category, language, page = 1, limit = 10 } = req.query;
        const parsedPage = Math.max(1, parseInt(page));
        const parsedLimit = Math.min(50, Math.max(1, parseInt(limit))); // Set max limit to 50
        
        const skip = (parsedPage - 1) * parsedLimit;
        
        const query = {};
        if (category) query.category = category;
        if (language) query.language = language;

        const [posts, total] = await Promise.all([
          Post.find(query)
            .skip(skip)
            .limit(parsedLimit)
            .sort({ createdAt: -1 })
            .populate('author', 'name'),
          Post.countDocuments(query)
        ]);
        
        res.status(200).json({ 
          success: true, 
          data: posts, 
          total,
          page: parsedPage,
          totalPages: Math.ceil(total / parsedLimit)
        });
        break;
      }

      case 'POST': {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return res.status(401).json({ success: false, message: 'Authorization token required' });
        }

        const user = await verifyToken(token);
        if (!user) {
          return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        if (!req.body.title || !req.body.content) {
          return res.status(400).json({ 
            success: false, 
            message: 'Title and content are required' 
          });
        }

        const post = await Post.create({
          ...req.body,
          author: user.id
        });

        res.status(201).json({ success: true, data: post });
        break;
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ success: false, message: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}