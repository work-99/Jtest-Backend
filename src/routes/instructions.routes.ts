import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { listInstructions, addInstruction, updateInstruction, deleteInstruction } from '../controllers/instructions.controller';

const router = Router();

router.use(authenticateToken);
router.get('/', listInstructions);
router.post('/', addInstruction);
router.put('/:id', updateInstruction);
router.delete('/:id', deleteInstruction);

export default router; 