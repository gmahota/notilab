"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Clock } from "lucide-react"

interface WorkflowCommentsProps {
  itemId: string
}

export function WorkflowComments({ itemId }: WorkflowCommentsProps) {
  const [comments] = useState([
    {
      id: "1",
      author: "Maria Revisora",
      content: "Excelente artigo! Apenas algumas sugestões de melhoria na conclusão.",
      createdAt: "2024-01-15T14:30:00Z",
      type: "feedback",
    },
    {
      id: "2",
      author: "João Redator",
      content: "Obrigado pelo feedback! Já implementei as alterações sugeridas.",
      createdAt: "2024-01-15T16:45:00Z",
      type: "response",
    },
  ])

  const [newComment, setNewComment] = useState("")

  const handleAddComment = () => {
    if (newComment.trim()) {
      // Implementar adição de comentário
      setNewComment("")
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-white font-medium mb-4 flex items-center">
        <MessageSquare className="w-4 h-4 mr-2" />
        Comentários ({comments.length})
      </h3>

      <div className="space-y-4 mb-4">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex items-start space-x-3">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs bg-blue-600 text-white">
                  {comment.author
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-white text-sm font-medium">{comment.author}</span>
                  <div className="flex items-center text-xs text-gray-400">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(comment.createdAt).toLocaleDateString("pt-PT")}
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{comment.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Adicionar comentário..."
          className="bg-gray-700 border-gray-600 text-white"
          rows={2}
        />
        <Button
          onClick={handleAddComment}
          disabled={!newComment.trim()}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          Comentar
        </Button>
      </div>
    </div>
  )
}
