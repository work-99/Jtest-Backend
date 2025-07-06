import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { listInstructions, addInstruction, updateInstruction, deleteInstruction } from '../controllers/instructions.controller';
import { asyncHandler } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.get('/', asyncHandler(listInstructions));
router.post('/', asyncHandler(addInstruction));
router.put('/:id', asyncHandler(updateInstruction));
router.delete('/:id', asyncHandler(deleteInstruction));

export default router; 