"""LampMind Assistant main file"""
from gpt_researcher.agent import LampMindAgent


def main():
    """Main function"""
    agent = LampMindAgent()
    agent.run()

if __name__ == "__main__":
    main()