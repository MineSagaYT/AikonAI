
import React from 'react';
import { Task } from '../types';

interface TaskListProps {
    tasks: Task[];
    onTaskUpdate: (taskId: string, completed: boolean) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskUpdate }) => {
    if (!tasks || tasks.length === 0) {
        return <p className="text-gray-400 italic">You have no tasks.</p>;
    }

    // Sort tasks so that incomplete ones are at the top
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed === b.completed) {
             return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }
        return a.completed ? 1 : -1; // Incomplete tasks first
    });

    return (
        <div className="my-2 space-y-2">
            <h4 className="text-lg font-bold text-amber-400 border-b border-gray-700 pb-2 mb-3">Your To-Do List</h4>
            <ul className="space-y-2">
                {sortedTasks.map(task => (
                    <li key={task.id} className="flex items-center">
                        <input
                            type="checkbox"
                            id={`task-${task.id}`}
                            checked={task.completed}
                            onChange={(e) => onTaskUpdate(task.id, e.target.checked)}
                            className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-600 cursor-pointer"
                        />
                        <label
                            htmlFor={`task-${task.id}`}
                            className={`ml-3 text-white transition-colors duration-200 ${task.completed ? 'line-through text-gray-500' : ''}`}
                        >
                            {task.description}
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TaskList;