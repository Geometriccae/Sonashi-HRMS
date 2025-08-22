import React, { useState } from 'react';
import styles from './TaskBoard.module.css';

import plus from '../../assets/dashboard/plus.svg';
import add_circle_outline from '../../assets/dashboard/add_circle_outline.svg';
import trashred from '../../assets/dashboard/trash-red.svg';
import more_horiz from '../../assets/dashboard/more_horiz.svg';
import pencilline from '../../assets/dashboard/pencil-line.svg';


const TaskBoard = () => {
  const [taskColumns, setTaskColumns] = useState([
    {
      id: 'backlog',
      title: 'Backlog Tasks',
      count: 5,
      countColor: 'yellow',
      tasks: [
        {
          id: 1,
          date: '11/07/2025',
          title: 'This is an entry with a very long title as the task.',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 2,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 3,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 4,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        }
      ]
    },
    {
      id: 'todo',
      title: 'To Do Tasks',
      count: 3,
      countColor: 'pink',
      tasks: [
        {
          id: 5,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 6,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        }
      ]
    },
    {
      id: 'inprogress',
      title: 'In Progress',
      count: 2,
      countColor: 'purple',
      tasks: [
        {
          id: 7,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 8,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 9,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        }
      ]
    },
    {
      id: 'done',
      title: 'Done',
      count: 5,
      countColor: 'green',
      tasks: [
        {
          id: 10,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 11,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 12,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        },
        {
          id: 13,
          date: '11/07/2025',
          title: 'Model Answer',
          priority: 'Priority:Medium',
          avatars: 'https://api.builder.io/api/v1/image/assets/TEMP/9618b216ac9c01c046c3b565636c4645a33c3c6d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9'
        }
      ]
    }
  ]);

  const [dragOverColumn, setDragOverColumn] = useState(null);

  const handleDragStart = (e, taskId, sourceColumnId) => {
    if (!taskId || !sourceColumnId) {
      e.preventDefault();
      return;
    }

    try {
      e.dataTransfer.setData('text/plain', JSON.stringify({ taskId, sourceColumnId }));
      e.dataTransfer.effectAllowed = 'move';
    } catch (error) {
      console.error('Error during drag start:', error);
      e.preventDefault();
    }
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    try {
      const dragData = e.dataTransfer.getData('text/plain');
      if (!dragData) return;

      const data = JSON.parse(dragData);
      const { taskId, sourceColumnId } = data;

      if (!taskId || !sourceColumnId || sourceColumnId === targetColumnId) {
        return;
      }

      setTaskColumns(prevColumns => {
        const newColumns = [...prevColumns];
        const sourceColumnIndex = newColumns.findIndex(col => col.id === sourceColumnId);
        const targetColumnIndex = newColumns.findIndex(col => col.id === targetColumnId);

        if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
          return prevColumns;
        }

        const taskToMove = newColumns[sourceColumnIndex].tasks.find(task => task.id === parseInt(taskId));

        if (!taskToMove) {
          return prevColumns;
        }

        newColumns[sourceColumnIndex].tasks = newColumns[sourceColumnIndex].tasks.filter(task => task.id !== parseInt(taskId));
        newColumns[targetColumnIndex].tasks.push(taskToMove);

        newColumns[sourceColumnIndex].count = newColumns[sourceColumnIndex].tasks.length;
        newColumns[targetColumnIndex].count = newColumns[targetColumnIndex].tasks.length;

        return newColumns;
      });
    } catch (error) {
      console.error('Error during drag and drop:', error);
    }
  };

  const TaskCard = ({ task, isMinimal = false, columnId }) => {
    if (isMinimal) {
      return (
        <div
          className={styles.cardMinimal}
          draggable
          onDragStart={(e) => handleDragStart(e, task.id, columnId)}
        >
          <div className={styles.taskDate}>{task.date}</div>
          <div className={styles.taskTitle}>{task.title}</div>
        </div>
      );
    }

    return (
      <div
        className={styles.taskCard}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id, columnId)}
      >
        <div className={styles.taskDate}>{task.date}</div>
        <div className={styles.taskHeader}>
          <div className={styles.taskTitle}>{task.title}</div>
        </div>
        <div className={styles.taskTags}>
          <div className={styles.priorityBadge}>
            <div className={styles.badgeText}>{task.priority}</div>
          </div>
        </div>
        <div className={styles.taskFooter}>
          <div className={styles.avatarGroup}>
            <img 
              src={task.avatars} 
              alt="avatars" 
              className={styles.avatarImage}
            />
            <div className={styles.addButton}>
              <img 
                src={add_circle_outline}
                alt="Add"
                className={styles.addIcon}
              />
            </div>
          </div>
          <div className={styles.actionIcons}>
            <img 
              src={pencilline}
              alt="edit"
              className={styles.actionIcon}
            />
            <img 
              src={trashred}
              alt="delete"
              className={styles.actionIcon}
            />
          </div>
        </div>
      </div>
    );
  };

  const Column = ({ column }) => {
    const isDragOver = dragOverColumn === column.id;

    return (
      <div
        className={`${styles.column} ${isDragOver ? styles.dragOver : ''}`}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        <div className={styles.columnHeader}>
          <div className={styles.columnLeft}>
            <div className={styles.columnTitle}>{column.title}</div>
            <div className={`${styles.counter} ${styles[`counter${column.countColor.charAt(0).toUpperCase() + column.countColor.slice(1)}`]}`}>
              <div className={styles.badgeNumber}>{column.count}</div>
            </div>
          </div>
          <img 
            src={more_horiz}
            alt="More options"
            className={styles.moreIcon}
          />
        </div>
        <div className={styles.columnContent}>
          {column.tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isMinimal={index === column.tasks.length - 1 && column.tasks.length > 3}
            />
          ))}
        </div>
        {(column.id === 'todo' || column.id === 'inprogress') && (
          <div className={styles.addColumnButton}>
            <img 
              src={add_circle_outline}
              alt="Add"
              className={styles.addColumnIcon}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.taskBoard}>
      <div className={styles.boardContainer}>
        {taskColumns.map(column => (
          <Column key={column.id} column={column} />
        ))}
        <div className={styles.addNewColumn}>
          <div className={styles.addColumnHeader}>
            <div className={styles.addColumnText}>Add new Column</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
