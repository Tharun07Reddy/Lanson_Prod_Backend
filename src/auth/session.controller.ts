import { Controller, Get, Delete, Param, UseGuards, Req, HttpStatus, HttpCode, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionService } from './session.service';
import { UserSession } from '@prisma/client';

interface RequestWithUser {
  user: {
    id: string;
    sub: string;
    email: string;
    username?: string;
  };
}

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async getUserSessions(@Req() req: RequestWithUser): Promise<UserSession[]> {
    const userId = req.user.sub;
    return this.sessionService.getActiveSessions(userId);
  }

  @Get(':id')
  async getSessionById(@Req() req: RequestWithUser, @Param('id') id: string): Promise<UserSession> {
    const userId = req.user.sub;
    const session = await this.sessionService.findSessionById(id);
    
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    
    // Only allow users to access their own sessions
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this session');
    }
    
    return session;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateSession(@Req() req: RequestWithUser, @Param('id') id: string): Promise<void> {
    const userId = req.user.sub;
    const session = await this.sessionService.findSessionById(id);
    
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    
    // Only allow users to terminate their own sessions
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have permission to terminate this session');
    }
    
    await this.sessionService.deactivateSession(id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateAllSessions(@Req() req: RequestWithUser): Promise<void> {
    const userId = req.user.sub;
    // Get current session ID to keep it active
    const currentSession = req.user['sessionId'];
    
    await this.sessionService.deactivateAllUserSessions(userId, currentSession);
  }
} 