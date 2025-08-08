import React from 'react';
import styles from './TaskBoard.module.css';

const TaskBoard = () => {
  const taskColumns = [
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
  ];

  const TaskCard = ({ task, isMinimal = false }) => {
    if (isMinimal) {
      return (
        <div className={styles.cardMinimal}>
          <div className={styles.taskDate}>{task.date}</div>
          <div className={styles.taskTitle}>{task.title}</div>
        </div>
      );
    }

    return (
      <div className={styles.taskCard}>
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
                src="https://api.builder.io/api/v1/image/assets/TEMP/a7abb24ae0a759be58657920b81076632b2671fc?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
                alt="Add"
                className={styles.addIcon}
              />
            </div>
          </div>
          <div className={styles.actionIcons}>
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/45efb6fbe47be4a0d2d0a44ec070000fd38aa203?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
              alt="Action 1"
              className={styles.actionIcon}
            />
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/49a0554bb3655ef38eccd883425f773f54cd743d?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
              alt="Action 2"
              className={styles.actionIcon}
            />
          </div>
        </div>
      </div>
    );
  };

  const Column = ({ column }) => {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>
          <div className={styles.columnLeft}>
            <div className={styles.columnTitle}>{column.title}</div>
            <div className={`${styles.counter} ${styles[`counter${column.countColor.charAt(0).toUpperCase() + column.countColor.slice(1)}`]}`}>
              <div className={styles.badgeNumber}>{column.count}</div>
            </div>
          </div>
          <img 
            src="https://api.builder.io/api/v1/image/assets/TEMP/264e8fcf91d26099b65ebe7c8b4d2b60502272c6?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
            alt="More options"
            className={styles.moreIcon}
          />
        </div>
        <div className={styles.columnContent}>
          {column.tasks.map((task, index) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              isMinimal={index === column.tasks.length - 1 && column.tasks.length > 3}
            />
          ))}
        </div>
        {(column.id === 'todo' || column.id === 'inprogress') && (
          <div className={styles.addColumnButton}>
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/f964c8148338abb81481ff9a67628d4f2aeee55a?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
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
